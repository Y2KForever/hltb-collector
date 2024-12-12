import { AttributeValue, BatchGetItemCommand, BatchWriteItemCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CheckItemsResult } from './types';

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
          name: { S: game.name },
          platform: { S: game.platform },
          status: { S: game.status },
          time: { N: game.time.toString() },
          img: { S: game.img },
          completed: { S: game.completed ? game.completed : '' },
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
  if(!timeString){
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
    item1.name === item2.name &&
    item1.platform === item2.platform &&
    parseInt(item1.time) === parseInt(item2.time) &&
    item1.status === item2.status &&
    item1.completed === item2?.completed
  );
};

export const checkIfExistInDdb = async (games: any[], client: DynamoDBClient): Promise<CheckItemsResult> => {
  const tableName = 'hltb-games';
  if (!tableName) {
    throw new Error(`Table name not defined`);
  }

  // Extract unique names to check
  const keysToCheck = games.map((game) => ({
    name: { S: game.name }, // DynamoDB expects attribute format
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
    if (game.name === 'Call of Duty: World at War'){
      console.log('game', game);
      console.log('res', results);
    }
      const matchingItem = results.find(
        (ddbItem) =>
          ddbItem.name.S === game.name &&
          ddbItem.time?.N === convertToMilliseconds(game.time).toString() &&
          Boolean(ddbItem.completed?.S) === Boolean(game.completed) &&
          ddbItem.status?.S === game.status,
      );

    if (matchingItem) {
      existingItems.push(game);
    } else {
      nonExistingItems.push(game);
    }
  });

  return { existingItems, nonExistingItems };
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
