interface Games {
  name: string;
  platform: string;
  status: string;
  time: string | number;
  img: string;
}

interface PossiblyEmptyGames {
  name?: string;
  platform?: string;
  status?: string;
  time?: string | number;
  img?: string;
}

interface CheckItemsResult {
  existingItems: Games[];
  nonExistingItems: NonExistingGame[];
}

interface NonExistingGame {
  name: string;
  url: string;
  platform: string;
  status: string;
  completed: string;
  time: string | number;
}

interface Event {
  params: string[];
}

export { CheckItemsResult, Games, PossiblyEmptyGames, Event, NonExistingGame };
