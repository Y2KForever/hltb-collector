import puppeteer from 'puppeteer-core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import chromium from '@sparticuz/chromium';
import { checkIfExistInDdb, createChunks, inputToDb, remapGames } from './utils';
import { Game, GamesResponse } from './types';
import { Handler } from 'aws-lambda';
const client = new DynamoDBClient({});

export const handler: Handler = async () => {
  try {
    const games: Game[] = [];
    let numOfPages: number = 0;
    const hltbLink = process.env.hltbLink;

    if (!hltbLink) {
      console.error('No link set, existing');
      process.exit(1);
    }

    const browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      defaultViewport: chromium.defaultViewport,
      args: [...chromium.args, '--no-sandbox', '--disable-gpu'],
      protocolTimeout: 240000,
    });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    );

    page.on('response', async (response) => {
      if (response.url().includes('/api/user/280015/games/list')) {
        try {
          const jsonResp = (await response.json()) as GamesResponse;
          console.log('count', jsonResp.data.count);
          console.log('total', jsonResp.data.total);
          games.push(...jsonResp.data.gamesList);
          numOfPages = Math.ceil(Number(jsonResp.data.total / 500));
        } catch (err) {
          console.error('Failed to parse games list response:', err);
        }
      }
    });

    console.log('\x1b[32m%s\x1b[0m', 'Navigating to HLTB page...');
    await page.goto(hltbLink, { waitUntil: 'networkidle2' });

    console.log('Number of pages:', numOfPages);

    if (games.length === 0) {
      console.error(`No games in list. Exiting.`);
      process.exit(1);
    }

    for (let i = 1; i <= numOfPages; i++) {
      if (i > 1) {
        const nextBtn = await page.$('[class^="Pagination_right__GwBE_"]');
        if (nextBtn) {
          await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), nextBtn.click()]);
          await page.waitForSelector('[class^="UserGameList_table_row"]');
        }
      }
    }

    for (const page of await browser.pages()) {
      await page.close();
    }
    await browser.close();

    console.log(`Total games collected: ${games.length}`);

    const existingGames = games.map(remapGames);

    const { changedItems = [] } = await checkIfExistInDdb(existingGames, client);

    console.log('changedItems', changedItems);

    for (const batch of createChunks([...changedItems], 25)) {
      await inputToDb(batch, client);
    }
    console.log('\x1b[32m%s\x1b[0m', `Finished uploading!`);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error:', error);
  }
};
