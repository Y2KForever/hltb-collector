type GamesResponse = {
  data: {
    count: number;
    gamesList: Game[];
    total: number;
    platformList: Platform[];
    summaryData: {
      playCount: number;
      dlcCount: number;
      reviewTotal: number;
      reviewCount: number;
      totalPlayedSp: number;
      totalPlayedMp: number;
      toBeatListed: number;
      uniqueGameCount: number;
    };
  };
};

type Game = {
  id: number;
  custom_title: string;
  platform: string;
  play_storefront: string;

  // List Flags
  list_playing: number;
  list_backlog: number;
  list_replay: number;
  list_custom: number;
  list_custom2: number;
  list_custom3: number;
  list_comp: number;
  list_retired: number;

  // Completion Metrics
  comp_main: number;
  comp_plus: number;
  comp_100: number;
  comp_speed: number;
  comp_speed100: number;

  // Completion Notes
  comp_main_notes: string;
  comp_plus_notes: string;
  comp_100_notes: string;
  comp_speed_notes: string;
  comp_speed100_notes: string;

  // Invested Time
  invested_pro: number;
  invested_sp: number;
  invested_spd: number;
  invested_co: number;
  invested_mp: number;

  // Play Counts and Reviews
  play_count: number;
  play_dlc: number;
  review_score: number;
  review_notes: string;

  // Dates
  date_start: string; // Format: YYYY-MM-DD
  date_complete: string; // Format: YYYY-MM-DD or "0000-00-00"
  date_updated: string; // Format: YYYY-MM-DD HH:mm:ss

  // Miscellaneous
  play_video: string;
  play_notes: string;
  retired_notes: string;

  // Game Metadata
  game_id: number;
  game_image: string;
  game_type: string;
  release_world: string; // Format: YYYY-MM-DD

  // Global Metrics
  comp_all: number;
  comp_main_g: number;
  review_score_g: number;
};

type Platform = {
  platform: string;
  count_total: number;
};

interface DdbGames {
  name: {
    S: string;
  };
  platform: {
    S: string;
  };
  status: {
    S: string;
  };
  time: {
    N: string;
  };
  img: {
    S: string;
  };
}

interface PossiblyEmptyGames {
  name?: string;
  platform?: string;
  status?: string;
  time?: string | number;
  img?: string;
}

interface CheckItemsResult {
  existingItems: DdbGames[];
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

export { CheckItemsResult, PossiblyEmptyGames, NonExistingGame, GamesResponse, Game };
