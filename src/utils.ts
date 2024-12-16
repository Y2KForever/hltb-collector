import { AttributeValue, BatchGetItemCommand, BatchWriteItemCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CheckItemsResult, Game } from './types';

export async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
export const inputToDb = async (games: any[], client: DynamoDBClient) => {
  const tableName = 'hltb-games';
  if (!tableName) {
    throw new Error(`Table name not defined`);
  }

  const gameList: any[] = games.map((game, idx) => {
    return {
      PutRequest: {
        Item: {
          name: { S: game.name.S },
          platform: { S: game.platform.S },
          status: { S: game.status.S },
          time: { N: game.time.N.toString() },
          img: { S: game.img.S },
          completed: { S: game.completed.S ? game.completed.S : '' },
          lastModifiedAt: { S: new Date().toISOString().split('T')[0] },
        },
      },
    };
  });

  await client.send(
    new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: gameList.map((item) => ({
          PutRequest: {
            Item: Object.entries(item.PutRequest.Item).reduce(
              (acc, [key, value]) => ({ ...acc, [key]: transformAttributeValue(value) }),
              {},
            ),
          },
        })),
      },
    }),
  );
};

export const createChunks = <T>(array: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
    array.slice(index * size, index * size + size),
  );
};

export const convertToMilliseconds = (timeString: string): number | string => {
  if (!timeString) {
    return timeString;
  }
  const regex = /(?:(\d+)[hH])?\s*(?:(\d+)[mM])?/;
  const match = timeString.match(regex);
  if (match) {
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    return hours * 60 * 60 * 1000 + minutes * 60 * 1000;
  }
  return Number(timeString);
};

export const transformAttributeValue = (value: any): AttributeValue => {
  if (typeof value === 'object') {
    if ('N' in value || 'S' in value || 'NS' in value || 'SS' in value) {
      return value;
    }
    throw new Error(`Unsupported attribute value: ${JSON.stringify(value)}`);
  } else {
    return { S: value.toString() };
  }
};

export const isSameItem = (item1: any, item2: any): boolean => {
  return (
    item1.name.S === item2.name.S &&
    item1.platform.S === item2.platform.S &&
    parseInt(item1.time.N) === parseInt(item2.time.N) &&
    item1.status.S === item2.status.S &&
    Boolean(item1.completed.S) === Boolean(item2.completed.S)
  );
};

export const checkIfExistInDdb = async (games: any[], client: DynamoDBClient): Promise<CheckItemsResult> => {
  const tableName = 'hltb-games';
  if (!tableName) {
    throw new Error(`Table name not defined`);
  }

  const keysToCheck = games.map((game) => ({
    name: { S: game.name.S },
  }));

  // Split into chunks of 100 (BatchGetItem limit)
  const createChunks = (arr: any[], chunkSize: number) =>
    arr.reduce((acc, _, i) => {
      if (i % chunkSize === 0) acc.push(arr.slice(i, i + chunkSize));
      return acc;
    }, [] as any[][]);
  const chunks = createChunks(keysToCheck, 100);

  const processBatch = async (batch: any[]) => {
    const params = {
      RequestItems: {
        [tableName]: {
          Keys: batch,
        },
      },
    };
    try {
      const data = await client.send(new BatchGetItemCommand(params));
      return data.Responses?.[tableName] || [];
    } catch (err) {
      throw err;
    }
  };

  const results: any[] = [];
  for (const chunk of chunks) {
    const chunkResult = await processBatch(chunk);
    results.push(...chunkResult);
  }

  // Compare games with DynamoDB results
  const existingItems: any[] = [];
  const nonExistingItems: any[] = [];

  games.forEach((game) => {
    const matchingItem = results.find((ddbItem) => ddbItem.name.S === game.name.S);

    if (matchingItem) {
      existingItems.push(matchingItem);
    } else {
      nonExistingItems.push(game);
    }
  });

  return { existingItems, nonExistingItems };
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const remapGames = (game: Game) => {
  const time = (game.invested_pro + game.invested_sp + game.invested_spd + game.invested_co + game.invested_mp) * 1000;

  const status = game.list_playing
    ? 'PLAYING'
    : game.list_backlog
    ? 'BACKLOG'
    : game.list_comp
    ? 'COMPLETED'
    : game.list_retired
    ? 'RETIRED'
    : null;

  return {
    name: { S: game.custom_title },
    platform: { S: game.platform },
    time: { N: time.toString() },
    status: { S: status },
    completed: { S: game.date_complete > '0000-00-00' ? game.date_complete : undefined },
    img: { S: game.game_image ? `https://howlongtobeat.com/games/${game.game_image}` : undefined },
  };
};
