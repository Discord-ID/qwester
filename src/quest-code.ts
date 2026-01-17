import type {
	ApiClient,
	ApiResponse,
	ApplicationData,
	DiscordQuest,
	FakeGame,
	FluxDispatcherType,
	GuildVocal,
	HeartbeatData,
	HeartbeatResponse,
	QuestStore,
	RunningGame,
	VideoProgressResponse,
	WebpackRequire,
} from "./types";

((): void => {
	function waitForWebpack(callback: (wpRequire: WebpackRequire) => void): void {
		const checkInterval = 100;
		const maxAttempts = 100;
		let attempts = 0;

		const check = (): void => {
			if (attempts >= maxAttempts) {
				console.error(
					"Discord Quest Helper: Failed to load webpack after multiple attempts.",
				);
				return;
			}

			if (typeof window.webpackChunkdiscord_app === "undefined") {
				attempts++;
				setTimeout(check, checkInterval);
				return;
			}

			try {
				const originalJQuery = window.$;
				delete window.$;

				const webpackRequire = window.webpackChunkdiscord_app.push([
					[Symbol()],
					{},
					(require: unknown) => require,
				]) as unknown as WebpackRequire;
				window.webpackChunkdiscord_app.pop();

				if (originalJQuery) window.$ = originalJQuery;

				if (
					!webpackRequire ||
					!webpackRequire.c ||
					Object.keys(webpackRequire.c).length < 10
				) {
					attempts++;
					setTimeout(check, checkInterval);
					return;
				}

				console.debug(
					`Discord Quest Helper: Webpack loaded with ${Object.keys(webpackRequire.c).length} modules.`,
				);
				callback(webpackRequire);
			} catch (error) {
				console.error("Discord Quest Helper: Error accessing webpack:", error);
				attempts++;
				setTimeout(check, checkInterval);
			}
		};

		check();
	}

	function findModule(
		webpackRequire: WebpackRequire,
		filter: (m: unknown) => boolean | undefined,
	): unknown {
		const modules = Object.values(webpackRequire.c);
		for (const module of modules) {
			if (module?.exports) {
				const exports = module.exports as Record<string, unknown>;
				if (exports.Z && filter(exports.Z)) return exports.Z;
				if (exports.ZP && filter(exports.ZP)) return exports.ZP;
				if (filter(exports)) return exports;
			}
		}
		return null;
	}

	async function runQuestCode(webpackRequire: WebpackRequire): Promise<void> {
		try {
			console.info("Discord Quest Helper: Initializing...");

			const userAgent = navigator.userAgent;
			if (userAgent.includes("Electron/")) {
				console.debug(
					"Discord Quest Helper: User-Agent override is active (Electron detected).",
				);
			} else {
				console.warn(
					'Discord Quest Helper: User-Agent does not contain "Electron/". Some quests might fail.',
				);
			}

			const stores = loadStores(webpackRequire);
			if (!stores) return;

			const { QuestsStore } = stores;

			if (!QuestsStore.quests || QuestsStore.quests.size === 0) {
				console.log(
					"Discord Quest Helper: No quests found. Please accept a quest first!",
				);
				return;
			}

			const activeQuests = [...QuestsStore.quests.values()].filter(
				(quest: DiscordQuest) => {
					const isExpired =
						new Date(quest.config.expiresAt).getTime() <= Date.now();
					const isCompleted = !!quest.userStatus?.completedAt;
					const isEnrolled = !!quest.userStatus?.enrolledAt;
					return isEnrolled && !isCompleted && !isExpired;
				},
			);

			if (activeQuests.length === 0) {
				console.info(
					"Discord Quest Helper: You don't have any uncompleted active quests!",
				);
				return;
			}

			console.info(
				`Discord Quest Helper: Found ${activeQuests.length} active quest(s).`,
			);

			const isDesktopApp = typeof window.DiscordNative !== "undefined";
			if (!isDesktopApp) {
				console.info(
					"Discord Quest Helper: Spoofing Desktop Client via Heartbeat Simulation.",
				);
			}

			await Promise.all(
				activeQuests.map((quest: DiscordQuest) =>
					processQuest(quest, stores, isDesktopApp),
				),
			);

			console.info("Discord Quest Helper: All quests processing finished!");
		} catch (error) {
			console.error("Discord Quest Helper: Critical error:", error);
		}
	}

	function loadStores(webpackRequire: WebpackRequire): {
		ApplicationStreamingStore: {
			getStreamerActiveStreamMetadata: () => unknown;
		};
		RunningGameStore: RunningGame;
		QuestsStore: QuestStore;
		ChannelStore: { getSortedPrivateChannels: () => { id: string }[] };
		GuildChannelStore: { getAllGuilds: () => Record<string, GuildVocal> };
		FluxDispatcher: FluxDispatcherType;
		api: ApiClient;
	} | null {
		try {
			const ApplicationStreamingStore = findModule(
				webpackRequire,
				(m: unknown) => {
					const module = m as Record<string, unknown>;
					return (
						"getStreamerActiveStreamMetadata" in module ||
						"getStreamerActiveStreamMetadata" in
							(Object.getPrototypeOf(module) as Record<string, unknown>)
					);
				},
			);
			const RunningGameStore = findModule(webpackRequire, (m: unknown) => {
				const module = m as Record<string, unknown>;
				return "getRunningGames" in module;
			});
			const QuestsStore = findModule(webpackRequire, (m: unknown) => {
				const module = m as Record<string, unknown>;
				return (
					"getQuest" in module ||
					"getQuest" in
						(Object.getPrototypeOf(module) as Record<string, unknown>)
				);
			});
			const ChannelStore = findModule(webpackRequire, (m: unknown) => {
				const module = m as Record<string, unknown>;
				return (
					"getAllThreadsForParent" in module ||
					"getAllThreadsForParent" in
						(Object.getPrototypeOf(module) as Record<string, unknown>)
				);
			});
			const GuildChannelStore = findModule(webpackRequire, (m: unknown) => {
				const module = m as Record<string, unknown>;
				return "getSFWDefaultChannel" in module;
			});
			const FluxDispatcher = findModule(webpackRequire, (m: unknown) => {
				const module = m as Record<string, unknown>;
				return (
					"flushWaitQueue" in module ||
					"flushWaitQueue" in
						(Object.getPrototypeOf(module) as Record<string, unknown>)
				);
			});
			const apiModule = findModule(webpackRequire, (m: unknown) => {
				const module = m as Record<string, unknown>;
				const tn = module.tn as Record<string, unknown> | undefined;
				return tn && "get" in tn;
			});

			if (
				!ApplicationStreamingStore ||
				!RunningGameStore ||
				!QuestsStore ||
				!ChannelStore ||
				!GuildChannelStore ||
				!FluxDispatcher ||
				!apiModule
			) {
				const missing = [];
				if (!ApplicationStreamingStore)
					missing.push("ApplicationStreamingStore");
				if (!RunningGameStore) missing.push("RunningGameStore");
				if (!QuestsStore) missing.push("QuestsStore");
				if (!ChannelStore) missing.push("ChannelStore");
				if (!GuildChannelStore) missing.push("GuildChannelStore");
				if (!FluxDispatcher) missing.push("FluxDispatcher");
				if (!apiModule) missing.push("API");
				throw new Error(`Could not find stores: ${missing.join(", ")}`);
			}

			const apiModule_ = apiModule as unknown as { tn: ApiClient };

			return {
				ApplicationStreamingStore: ApplicationStreamingStore as {
					getStreamerActiveStreamMetadata: () => unknown;
				},
				RunningGameStore: RunningGameStore as RunningGame,
				QuestsStore: QuestsStore as QuestStore,
				ChannelStore: ChannelStore as {
					getSortedPrivateChannels: () => { id: string }[];
				},
				GuildChannelStore: GuildChannelStore as {
					getAllGuilds: () => Record<string, GuildVocal>;
				},
				FluxDispatcher: FluxDispatcher as FluxDispatcherType,
				api: apiModule_.tn,
			};
		} catch (error) {
			console.error("Discord Quest Helper: Error loading stores:", error);
			return null;
		}
	}

	async function processQuest(
		quest: DiscordQuest,
		stores: ReturnType<typeof loadStores>,
		isDesktopApp: boolean,
	): Promise<void> {
		if (!stores) return;
		const { api } = stores;
		const questName = quest.config.messages.questName;
		const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;

		if (!taskConfig) {
			console.error(
				`Discord Quest Helper: No task config found for quest "${questName}"`,
			);
			return;
		}

		const taskType = [
			"WATCH_VIDEO",
			"PLAY_ON_DESKTOP",
			"STREAM_ON_DESKTOP",
			"PLAY_ACTIVITY",
			"WATCH_VIDEO_ON_MOBILE",
		].find(
			(type) => (taskConfig.tasks as Record<string, unknown>)[type] != null,
		);

		if (!taskType) {
			console.warn(
				`Discord Quest Helper: Unknown task type for quest "${questName}"`,
			);
			return;
		}

		const taskData = (taskConfig.tasks as Record<string, { target: number }>)[
			taskType
		];
		const secondsNeeded = taskData.target;
		const currentProgress =
			(quest.userStatus?.progress?.[taskType as string]?.value as number) ?? 0;

		console.info(
			`Discord Quest Helper: Starting "${questName}" (${taskType}) - Progress: ${currentProgress}/${secondsNeeded}s`,
		);

		if (currentProgress >= secondsNeeded) {
			console.info(
				`Discord Quest Helper: Quest "${questName}" is already complete.`,
			);
			return;
		}

		try {
			switch (taskType) {
				case "WATCH_VIDEO":
				case "WATCH_VIDEO_ON_MOBILE":
					await handleWatchVideo(quest, api, secondsNeeded, currentProgress);
					break;
				case "PLAY_ON_DESKTOP":
					await handlePlayOnDesktop(
						quest,
						stores,
						isDesktopApp,
						secondsNeeded,
						currentProgress,
					);
					break;
				case "STREAM_ON_DESKTOP":
					await handleStreamOnDesktop(
						quest,
						stores,
						isDesktopApp,
						secondsNeeded,
						currentProgress,
					);
					break;
				case "PLAY_ACTIVITY":
					await handlePlayActivity(quest, stores, secondsNeeded);
					break;
				default:
					console.warn(`Discord Quest Helper: Unhandled task type ${taskType}`);
			}
		} catch (error) {
			console.error(
				`Discord Quest Helper: Error processing "${questName}":`,
				error,
			);
		}
	}

	async function handleWatchVideo(
		quest: DiscordQuest,
		api: ApiClient,
		secondsNeeded: number,
		initialProgress: number,
	): Promise<void> {
		const questName = quest.config.messages.questName;
		let secondsDone = initialProgress;
		const speed = 30;
		const interval = 5;

		console.info(`Discord Quest Helper: Watching video for "${questName}"...`);

		while (secondsDone < secondsNeeded) {
			secondsDone = Math.min(secondsNeeded, secondsDone + speed);

			await new Promise((resolve) => setTimeout(resolve, interval * 1000));

			const response = (await api.post({
				url: `/quests/${quest.id}/video-progress`,
				body: { timestamp: secondsDone },
			})) as ApiResponse<VideoProgressResponse>;

			if (response.body.completed_at) {
				console.info(`Discord Quest Helper: Quest "${questName}" completed!`);
				return;
			}

			console.debug(
				`Discord Quest Helper: "${questName}" progress: ${secondsDone}/${secondsNeeded}s`,
			);
		}
	}

	async function handlePlayOnDesktop(
		quest: DiscordQuest,
		stores: ReturnType<typeof loadStores>,
		isDesktopApp: boolean,
		secondsNeeded: number,
		_initialProgress: number,
	): Promise<void> {
		if (!stores) return;
		const { RunningGameStore, FluxDispatcher, api } = stores;
		const questName = quest.config.messages.questName;
		const applicationId = quest.config.application.id;

		if (!isDesktopApp) {
			await simulateHeartbeat(quest, api, "PLAY_ON_DESKTOP", secondsNeeded);
			return;
		}

		console.info(`Discord Quest Helper: Spoofing game for "${questName}"...`);

		const pid = Math.floor(Math.random() * 10000) * 4 + 1000;

		let appName = quest.config.application.name;
		let exeName = "game.exe";

		try {
			const appData = (await api.get({
				url: `/applications/public?application_ids=${applicationId}`,
			})) as ApiResponse<ApplicationData[]>;
			if (appData.body?.[0]) {
				const app = appData.body[0];
				appName = app.name;
				const winExe = app.executables?.find((x) => x.os === "win32");
				if (winExe) exeName = winExe.name.replace(">", "");
			}
		} catch (_e) {
			console.warn(
				"Discord Quest Helper: Could not fetch app details, using defaults.",
			);
		}

		const fakeGame: FakeGame = {
			cmdLine: `C:\\Program Files\\${appName}\\${exeName}`,
			exeName: exeName,
			exePath: `c:/program files/${appName.toLowerCase()}/${exeName}`,
			hidden: false,
			isLauncher: false,
			id: applicationId,
			name: appName,
			pid: pid,
			pidPath: [pid],
			processName: appName,
			start: Date.now(),
		};

		const originalGetRunningGames = RunningGameStore.getRunningGames;
		const originalGetGameForPID = RunningGameStore.getGameForPID;

		RunningGameStore.getRunningGames = () => [fakeGame];
		RunningGameStore.getGameForPID = (id: number) =>
			id === pid ? fakeGame : undefined;

		FluxDispatcher.dispatch({
			type: "RUNNING_GAMES_CHANGE",
			removed: [],
			added: [fakeGame],
			games: [fakeGame],
		});

		await waitForCompletion(stores, quest, "PLAY_ON_DESKTOP", secondsNeeded);

		RunningGameStore.getRunningGames = originalGetRunningGames;
		RunningGameStore.getGameForPID = originalGetGameForPID;
		FluxDispatcher.dispatch({
			type: "RUNNING_GAMES_CHANGE",
			removed: [fakeGame],
			added: [],
			games: [],
		});
	}

	async function handleStreamOnDesktop(
		quest: DiscordQuest,
		stores: ReturnType<typeof loadStores>,
		isDesktopApp: boolean,
		secondsNeeded: number,
		_initialProgress: number,
	): Promise<void> {
		if (!stores) return;
		const { ApplicationStreamingStore, api } = stores;
		const questName = quest.config.messages.questName;
		const applicationId = quest.config.application.id;

		if (!isDesktopApp) {
			await simulateHeartbeat(quest, api, "STREAM_ON_DESKTOP", secondsNeeded);
			return;
		}

		console.info(`Discord Quest Helper: Spoofing stream for "${questName}"...`);
		console.warn(
			"Discord Quest Helper: NOTE: You must be in a voice channel with at least one other person!",
		);

		const pid = Math.floor(Math.random() * 10000) * 4 + 1000;

		const originalGetStreamerActiveStreamMetadata =
			ApplicationStreamingStore.getStreamerActiveStreamMetadata;

		ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
			id: applicationId,
			pid: pid,
			sourceName: null,
		});

		await waitForCompletion(stores, quest, "STREAM_ON_DESKTOP", secondsNeeded);

		ApplicationStreamingStore.getStreamerActiveStreamMetadata =
			originalGetStreamerActiveStreamMetadata;
	}

	async function handlePlayActivity(
		quest: DiscordQuest,
		stores: ReturnType<typeof loadStores>,
		secondsNeeded: number,
	): Promise<void> {
		if (!stores) return;
		const { ChannelStore, GuildChannelStore, api } = stores;
		const questName = quest.config.messages.questName;

		console.info(
			`Discord Quest Helper: Simulating activity for "${questName}"...`,
		);

		const privateChannels = ChannelStore.getSortedPrivateChannels();
		let channelId = privateChannels[0]?.id;

		if (!channelId) {
			const guilds = Object.values(GuildChannelStore.getAllGuilds());
			const guildWithVoice = guilds.find((g) => g?.VOCAL && g.VOCAL.length > 0);
			if (guildWithVoice) {
				channelId = guildWithVoice.VOCAL[0].channel.id;
			}
		}

		if (!channelId) {
			console.error(
				"Discord Quest Helper: Could not find a voice channel to simulate activity in.",
			);
			return;
		}

		const streamKey = `call:${channelId}:1`;
		await runHeartbeatLoop(
			quest,
			api,
			streamKey,
			"PLAY_ACTIVITY",
			secondsNeeded,
		);
	}

	async function simulateHeartbeat(
		quest: DiscordQuest,
		api: ApiClient,
		taskName: string,
		secondsNeeded: number,
	): Promise<void> {
		const streamKey = `call:${quest.id}:1`;
		await runHeartbeatLoop(quest, api, streamKey, taskName, secondsNeeded);
	}

	async function runHeartbeatLoop(
		quest: DiscordQuest,
		api: ApiClient,
		streamKey: string,
		taskName: string,
		secondsNeeded: number,
	): Promise<void> {
		const questName = quest.config.messages.questName;

		while (true) {
			const response = (await api.post({
				url: `/quests/${quest.id}/heartbeat`,
				body: { stream_key: streamKey, terminal: false },
			})) as ApiResponse<HeartbeatResponse>;

			const progress =
				(response.body.progress[taskName as string]?.value as number) ?? 0;
			console.debug(
				`Discord Quest Helper: "${questName}" progress: ${progress}/${secondsNeeded}s`,
			);

			if (progress >= secondsNeeded) {
				await api.post({
					url: `/quests/${quest.id}/heartbeat`,
					body: { stream_key: streamKey, terminal: true },
				});
				console.info(`Discord Quest Helper: Quest "${questName}" completed!`);
				break;
			}

			await new Promise((resolve) => setTimeout(resolve, 20 * 1000));
		}
	}

	function waitForCompletion(
		stores: ReturnType<typeof loadStores>,
		quest: DiscordQuest,
		taskName: string,
		secondsNeeded: number,
	): Promise<void> {
		if (!stores) return Promise.resolve();
		return new Promise((resolve) => {
			const { FluxDispatcher } = stores;
			const questName = quest.config.messages.questName;

			const progressHandler = (data: unknown): void => {
				const heartbeatData = data as HeartbeatData;
				let progress = 0;
				if (heartbeatData.userStatus?.progress?.[taskName as string]) {
					progress = Math.floor(
						(
							heartbeatData.userStatus.progress[taskName as string] as {
								value: number;
							}
						).value,
					);
				} else if (heartbeatData.userStatus?.streamProgressSeconds) {
					progress = heartbeatData.userStatus.streamProgressSeconds;
				}

				console.debug(
					`Discord Quest Helper: "${questName}" progress: ${progress}/${secondsNeeded}s`,
				);

				if (progress >= secondsNeeded) {
					console.info(`Discord Quest Helper: Quest "${questName}" completed!`);
					FluxDispatcher.unsubscribe(
						"QUESTS_SEND_HEARTBEAT_SUCCESS",
						progressHandler,
					);
					resolve();
				}
			};

			FluxDispatcher.subscribe(
				"QUESTS_SEND_HEARTBEAT_SUCCESS",
				progressHandler,
			);
		});
	}

	waitForWebpack(runQuestCode);
})();
