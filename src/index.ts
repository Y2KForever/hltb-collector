import puppeteer from 'puppeteer';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Handler } from 'aws-lambda';
import { Event } from './types';
import chromium from '@sparticuz/chromium';
import axios from 'axios';
import { autoScroll, checkIfExistInDdb, convertToMilliseconds, createChunks, inputToDb, isSameItem } from './utils';

const client = new DynamoDBClient({});

const delayMs = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const asd = 'asd';

//export const handler: Handler = async (event: Event) => {
(async () => {
  try {
    const hltbLink = `https://howlongtobeat.com/user/Y2KForever/games/completed/1`;
    chromium.setGraphicsMode = false;
    const browser = await puppeteer.launch({
      headless: false,
      // executablePath: await chromium.executablePath(),
      // defaultViewport: chromium.defaultViewport,
      // args: [...chromium.args, '--no-sandbox'],
      // protocolTimeout: 240000,
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
    );
    console.log('\x1b[32m%s\x1b[0m', 'Navigating to HLTB page...');
    await page.goto(hltbLink);
    const cookieButton = await page
      .waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 })
      .catch(() => null);
    if (cookieButton) {
      await cookieButton.click();
    }
    const totalGamelist: any[] = [];
    const totalGameSet = new Set<string>();
    await page.waitForSelector('[class^="UserGameList_table_row"]');

    const gamesExist = await page.evaluate(() => document.body.innerHTML.search("Sorry, we've found no games!"));
    const listCount = (await page.$$('[class^="Pagination_user_pagination"]')).length;

    if (!gamesExist) {
      console.log('\x1b[32m%s\x1b[0m', `No games found, exiting...`);
      process.exit(0);
    }

    if (listCount > 0) {
      console.log('\x1b[32m%s\x1b[0m', `Found ${listCount} pages of games, running through them now...`);
    } else {
      console.log('\x1b[32m%s\x1b[0m', `Found 1 page of games, running through them now...`);
    }
    for (let i = 0; i <= listCount; i++) {
      const gameList: any[] = await page.$$eval('[class^="UserGameList_table_row"]', (items) => {
        return items.map((item, idx) => {
          if (idx !== 0) {
            const platform = item.querySelector('span')?.textContent?.trim();
            const name = item.querySelector('a')?.textContent?.trim();
            const status =
              item.querySelector('a')?.className === 'text_purple'
                ? 'COMPLETED'
                : item.querySelector('a')?.className === 'text_blue'
                ? 'BACKLOG'
                : item.querySelector('a')?.className === 'text_green'
                ? 'PLAYING'
                : 'REPLAYING';
            const url = item.querySelector('a')?.href;
            let time: any = 0;
            let completed = null;
            if (status !== 'COMPLETED') {
              time = item.childNodes[1].textContent === '--' ? 0 : item.childNodes[1].textContent;
            } else {
              const divs = Array.from(item.querySelectorAll('div'));
              completed = divs[1].textContent?.trim();
              (divs[3].children[0] as any).click();
            }
            return { name, url, platform, time, status, completed };
          }
        });
      });
      // if (asd !== 'asd') { // parameters === complete
      const updatedTimes = await page.$$eval('[class^="back_light"]', (items) => {
        return items.map((item) => item.textContent?.trim());
      });

      // // Update `gameList` with the new times
      gameList.forEach((game, index) => {
        if (index !== 0) {
          game.time = updatedTimes[index - 1] ?? 0;
        }
      });
      // }
      gameList
        .filter((item) => item !== null)
        .filter((game) => game && game.completed !== '--')
        .forEach((obj1) => {
          if (!totalGameSet.has(obj1.name)) {
            totalGameSet.add(obj1.name);
            totalGamelist.push(obj1);
          }
        });

      if (i < listCount) {
        const nextBtn = await page.$('[class^="Pagination_right__GwBE_"]');
        if (nextBtn) {
          await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), nextBtn.click()]);
          await page.waitForSelector('[class^="UserGameList_table_row"]');
        }
      }
    }

    const { existingItems = [], nonExistingItems = [] } = await checkIfExistInDdb(totalGamelist, client);

    console.log('\x1b[32m%s\x1b[0m', `Finished running through the games.`);
    console.log('\x1b[32m%s\x1b[0m', `Found a total of ${totalGameSet.size} games.`);
    console.log('\x1b[32m%s\x1b[0m', `Starting with images...`);

    //console.log('nonExistingItems', nonExistingItems);

    const images: string[] = [];
    for (const game of nonExistingItems) {
      await page.goto(game.url);
      const filteredImgSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map((img) => img.src);
      });
      if (filteredImgSrcs.length > 0) {
        if (filteredImgSrcs[0] as any) {
          images.push(filteredImgSrcs[0] as any);
        }
      }
    }

    console.log('\x1b[32m%s\x1b[0m', `Starting upload to DDB...`);

    const finalNonExisting = nonExistingItems.map((game, index) => {
      return {
        name: game.name,
        platform: game.platform,
        time: game.time !== 0 && typeof game.time === 'string' ? convertToMilliseconds(game.time) : 0,
        status: game.status,
        completed: game.completed || undefined,
        img: images[index],
      };
    });

    const updatedItems = existingItems.filter((game) => {
      const matchingItem = totalGamelist.find((dbItem) => dbItem.name === game.name);
      return matchingItem && !isSameItem(game, matchingItem);
    });

    console.log('updatedItems', JSON.stringify(updatedItems));
    console.log('finalNonExisting', JSON.stringify(finalNonExisting));

    for (const batch of createChunks([...finalNonExisting, ...updatedItems], 25)) {
      await inputToDb(batch, client);
    }

    console.log('\x1b[32m%s\x1b[0m', `Finished uploading!`);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error:', error);
  }
  //};
})();
