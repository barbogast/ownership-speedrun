
type Value = string | number | null | undefined
type Row = Record<string, Value>
type ReturnValue = Row[]

// import fs from "fs/promises";

const base64Encode = (data: unknown) =>
  btoa(JSON.stringify(data));

function formatDuration(durationInSeconds: number): string {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = durationInSeconds % 60;

  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = seconds.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

type Player = {
  id: string;
  name: string;
  url: string;
  powerLevel: number;
  color1Id: string;
  color2Id: string;
  colorAnimate: number;
  areaId: string;
};

type Run = {
  categoryId: string;
  comment: string;
  date: number;
  dateSubmitted: number;
  dateVerified: number;
  emulator: boolean;
  gameId: string;
  hasSplits: boolean;
  id: string;
  issues: null;
  obsolete: boolean;
  place: number;
  platformId: string;
  playerIds: string[];
  submittedById: string;
  time: number;
  valueIds: string[];
  verified: number;
  verifiedById: string;
  video: string;
};

type Pagination = {
  count: number;
  page: number;
  pages: number;
  per: number;
};

type FetchResponse =
  | { runList: Run[]; playerList: Player[]; pagination: Pagination }
  | { error: unknown };

type DerivedData = {
  wasRecord: boolean;
  name: string;
  timeFormatted: string;
  dateFormatted: string;
  recordDurationDays: number;
};

type EnhancedRun = {
  originalData: Run;
  derivedData: Partial<DerivedData>;
};

type Players = Record<string, string>;

const fetchPage = async (page: number) => {
  const params = {
    params: {
      categoryId: "ndxjper2",
      emulator: 0,
      gameId: "9d35xw1l",
      obsolete: 1,
      platformIds: [],
      regionIds: [],
      timer: 0,
      verified: 1,
      values: [],
      video: 0,
    },
    page,
    vary: 1692741938,
  };
  const encodedParams = base64Encode(params)
    // Remove trailing "=" signs (otherwise the request fails)
    .replace(/=+$/, "");

  const res = await fetch(
    `https://www.speedrun.com/api/v2/GetGameLeaderboard2?_r=${encodedParams}`
  );
  const data: FetchResponse = await res.json();

  if ("error" in data) {
    console.error(page, data.error);
    console.log(params);
    throw new Error("Error fetching data");
  }

  return data;
};

const sortByKey =
  <T extends string, U extends Record<T, unknown>>(key: T) =>
    (a: U, b: U) =>
      a[key] > b[key] ? 1 : b[key] > a[key] ? -1 : 0;

// const logRun = (run: Run, players: Players) =>
//   console.log(
//     `${players[run.playerIds[0]!]} - ${formatDuration(run.time)} ${new Date(
//       run.date * 1000
//     )}  }`
//   );

const formatValueForCsv = (value: unknown) =>
  typeof value === "string" ? `"${value}"` : value;

const writeRunDataToCsv = (runs: EnhancedRun[]) => {
  const originalDataColumns = [
    // "id",
    // "categoryId",
    // "comment",
    "date",
    // "dateSubmitted",
    // "dateVerified",
    // "emulator",
    // "gameId",
    // "hasSplits",
    // "issues",
    // "obsolete",
    // "place",
    // "platformId",
    // "playerIds",
    // "submittedById",
    "time",
    // "valueIds",
    // "verified",
    // "verifiedById",
    // "video",
  ] as const;

  const derivedDataColumns = [
    "wasRecord",
    "name",
    // "timeFormatted",
    "recordDurationDays",
  ] as const;

  const rows = []
  for (const run of runs) {
    const row = {}
    for (const key of originalDataColumns) {
      row[key] = run.originalData[key] ?? null
    }
    for (const key of derivedDataColumns) {
      row[key] = run.derivedData[key] ?? null
    }
    rows.push(row)
  }

  return rows
  // const data = runs
  //   .map((run) =>
  //     originalDataColumns
  //       .map((key) => formatValueForCsv(run.originalData[key]))
  //       .concat(
  //         derivedDataColumns.map((key) =>
  //           formatValueForCsv(run.derivedData[key])
  //         )
  //       )
  //       .join(",")
  //   )
  //   .join("\n");
  //   console.log(data)
  // await fs.writeFile("runs.csv", `${header}\n${data}`);
};

const getDurationInDays = (dt1: number, dt2: number) => {
  const diff = Math.abs(
    new Date(dt2 * 1000).getTime() - new Date(dt1 * 1000).getTime()
  );
  return diff / (1000 * 60 * 60 * 24);
};

const main = async () => {
  const { pagination, playerList, runList } = await fetchPage(1);
  for (let i = 2; i <= pagination.pages; i++) {
    const pageData = await fetchPage(i);
    runList.push(...pageData.runList);
  }

  // The players are sent with each response. We just take the ones of the first request.
  const players: Players = playerList.reduce((acc, player) => {
    return {
      ...acc,
      [player.id]: player.name,
    };
  }, {});

  runList.sort(sortByKey("date"));

  const enhancedRuns = runList.map((run) => ({
    originalData: run,
    derivedData: {
      name: players[run.playerIds[0]!],
      timeFormatted: formatDuration(run.time),
      dateFormatted: new Date(run.date * 1000).toISOString(),
    } as Partial<DerivedData>,
  }));

  let previousRecord: EnhancedRun | undefined = undefined;
  for (let i = 0; i < enhancedRuns.length; i++) {
    const run = enhancedRuns[i]!;
    const prevRun = enhancedRuns[i - 1];

    if (
      !prevRun ||
      !previousRecord ||
      run.originalData.time < previousRecord.originalData.time
    ) {
      run.derivedData.wasRecord = true;
      if (previousRecord) {
        previousRecord.derivedData.recordDurationDays = getDurationInDays(
          run.originalData.date,
          previousRecord.originalData.date
        );
      }
      previousRecord = run;
    } else {
      run.derivedData.wasRecord = false;
    }
  }

  // The most recent record's duration is until today
  previousRecord!.derivedData.recordDurationDays = getDurationInDays(
    new Date().getTime() / 1000,
    previousRecord!.originalData.date
  );

  return writeRunDataToCsv(enhancedRuns);

  // enhancedRuns
  //   .filter((r) => r.derivedData.wasRecord)
  //   .map((r) => logRun(r.originalData, players));

  // logRun(
  //   enhancedRuns.filter((r) => r.derivedData.wasRecord)[0]!.originalData,
  //   players
  // );
};

// main().catch(console.error);


function execute(): ReturnValue | Promise<ReturnValue> {
  // Your code here ...
  return main()
}

