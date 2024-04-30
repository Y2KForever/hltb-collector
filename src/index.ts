import puppeteer from 'puppeteer';
import fs from 'fs';
import { ENV_VARS } from './constants';
require('dotenv').config();

(async () => {
  try {
    const watchlistLink = process.env[ENV_VARS.watchlist_link];

    if (!watchlistLink) {
      console.error('\x1b[31m%s\x1b[0m', `Error: Watchlist link is empty.`);
      process.exit(1);
    }

    const scrollPageToBottom = await import('puppeteer-autoscroll-down');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
    );
    console.log('\x1b[32m%s\x1b[0m', 'Navigating to IMDb watchlist page...');
    await page.goto(watchlistLink);

    const button = await page.$('button.load-more');
    await button?.click();
    await scrollPageToBottom.scrollPageToBottom(page, {});

    const cookieButton = await page
      .waitForSelector('button[data-testid=accept-button]', { timeout: 5000 })
      .catch(() => null);
    if (cookieButton) {
      await cookieButton.click();
    }

    console.log('\x1b[32m%s\x1b[0m', 'Waiting for movie list to load...');
    await page.waitForSelector('.lister-item');

    const movieList = await page.$$eval('.lister-item', (items) => {
      return items.map((item) => {
        const name = item.querySelector('h3')?.textContent.trim();
        const url = item.querySelector('a')?.href;
        return { name, url };
      });
    });

    const images: string[] = [];
    for (const movie of movieList) {
      console.log('\x1b[32m%s\x1b[0m\x1b[34m%s\x1b[0m', 'Navigating to movie page: ', movie.url);
      await page.goto(movie.url);
      await page.waitForSelector('.ipc-media');
      const imageUrl = await page.$eval('.ipc-media', (item) => item.children[0].src);
      images.push(imageUrl);
    }

    const watchlist = movieList.map((movie, index) => ({
      PutRequest: {
        Item: {
          name: { S: movie.name },
          img: { S: images[index] },
        },
      },
    }));

    const chunks = [];
    for (let i = 0; i < watchlist.length; i += 25) {
      chunks.push(watchlist.slice(i, i + 25));
    }

    if (!fs.existsSync('./files')) {
      fs.mkdirSync('./files');
    }

    for (let i = 0; i < chunks.length; i++) {
      const json = { watchlist: chunks[i] };
      fs.writeFileSync(`./files/watchlist_${i + 1}.json`, JSON.stringify(json, null, 2), 'utf-8');
    }

    await browser.close();
    console.log('\x1b[32m%s\x1b[0m', 'Data successfully extracted and saved to files/watchlist_*.json');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error:', error);
  }
})();
