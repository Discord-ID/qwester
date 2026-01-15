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
	WebpackModule,
	WebpackRequire,
} from "./types";

((): void => {
	function waitForWebpack(
		callback: (wpRequire: WebpackRequire) => void,
		maxAttempts = 100,
		attempt = 0,
	): void {
		if (attempt >= maxAttempts) {
			console.error("Failed to load webpack after", maxAttempts, "attempts");
			return;
		}

		if (typeof window.webpackChunkdiscord_app === "undefined") {
			setTimeout(
				(): void => waitForWebpack(callback, maxAttempts, attempt + 1),
				100,
			);
			return;
		}

		let wpRequire: WebpackRequire | undefined;
		try {
			delete window.$;
			const result = window.webpackChunkdiscord_app.push([
				[Symbol()],
				{},
				(r: unknown) => r,
			]) as unknown as WebpackRequire;
			wpRequire = result;
			window.webpackChunkdiscord_app.pop();

			if (!wpRequire || !wpRequire.c || Object.keys(wpRequire.c).length === 0) {
				setTimeout(
					(): void => waitForWebpack(callback, maxAttempts, attempt + 1),
					100,
				);
				return;
			}

			const moduleCount = Object.keys(wpRequire.c).length;
			if (moduleCount < 10) {
				setTimeout(
					(): void => waitForWebpack(callback, maxAttempts, attempt + 1),
					100,
				);
				return;
			}

			console.log(`Webpack loaded with ${moduleCount} modules`);
		} catch (error) {
			console.error("Error accessing webpack:", error);
			setTimeout(
				(): void => waitForWebpack(callback, maxAttempts, attempt + 1),
				100,
			);
			return;
		}

		callback(wpRequire);
	}

	function runQuestCode(wpRequire: WebpackRequire): void {
		void (async (): Promise<void> => {
			try {
				const userAgent = navigator.userAgent;
				console.log("Current User-Agent:", userAgent);
				const hasElectron = userAgent.includes("Electron/");
				if (!hasElectron) {
					console.warn(
						'User-Agent does not contain "Electron/". Some quest types may not work.',
					);
				} else {
					console.log("User-Agent override is working (contains Electron/)");
				}

				let ApplicationStreamingStore: {
					getStreamerActiveStreamMetadata: () => unknown;
				};
				let RunningGameStore: RunningGame;
				let QuestsStore: QuestStore;
				let ChannelStore: {
					getSortedPrivateChannels: () => { id: string }[];
				};
				let GuildChannelStore: {
					getAllGuilds: () => Record<string, GuildVocal>;
				};
				let FluxDispatcher: FluxDispatcherType;
				let api: ApiClient;

				try {
					console.log("Loading Discord stores...");

					const appStreamingStore = Object.values(wpRequire.c).find(
						(x: WebpackModule) => {
							if (!x?.exports?.Z) return false;
							const moduleExports = x.exports.Z as Record<string, unknown>;
							const proto = Object.getPrototypeOf(moduleExports) as Record<
								string,
								unknown
							>;
							return "getStreamerActiveStreamMetadata" in proto;
						},
					)?.exports?.Z as
						| { getStreamerActiveStreamMetadata: () => unknown }
						| undefined;
					if (!appStreamingStore)
						throw new Error("Could not find ApplicationStreamingStore");
					ApplicationStreamingStore = appStreamingStore;

					const runningGameStore = Object.values(wpRequire.c).find(
						(x: WebpackModule) => {
							if (!x?.exports?.ZP) return false;
							const moduleExports = x.exports.ZP as Record<string, unknown>;
							return "getRunningGames" in moduleExports;
						},
					)?.exports?.ZP as RunningGame | undefined;
					if (!runningGameStore)
						throw new Error("Could not find RunningGameStore");
					RunningGameStore = runningGameStore;

					const questsStore = Object.values(wpRequire.c).find(
						(x: WebpackModule) => {
							if (!x?.exports?.Z) return false;
							const moduleExports = x.exports.Z as Record<string, unknown>;
							const proto = Object.getPrototypeOf(moduleExports) as Record<
								string,
								unknown
							>;
							return "getQuest" in proto;
						},
					)?.exports?.Z as QuestStore | undefined;
					if (!questsStore) throw new Error("Could not find QuestsStore");
					QuestsStore = questsStore;

					const channelStore = Object.values(wpRequire.c).find(
						(x: WebpackModule) => {
							if (!x?.exports?.Z) return false;
							const moduleExports = x.exports.Z as Record<string, unknown>;
							const proto = Object.getPrototypeOf(moduleExports) as Record<
								string,
								unknown
							>;
							return "getAllThreadsForParent" in proto;
						},
					)?.exports?.Z as
						| { getSortedPrivateChannels: () => { id: string }[] }
						| undefined;
					if (!channelStore) throw new Error("Could not find ChannelStore");
					ChannelStore = channelStore;

					const guildChannelStore = Object.values(wpRequire.c).find(
						(x: WebpackModule) => {
							if (!x?.exports?.ZP) return false;
							const moduleExports = x.exports.ZP as Record<string, unknown>;
							return "getSFWDefaultChannel" in moduleExports;
						},
					)?.exports?.ZP as
						| { getAllGuilds: () => Record<string, GuildVocal> }
						| undefined;
					if (!guildChannelStore)
						throw new Error("Could not find GuildChannelStore");
					GuildChannelStore = guildChannelStore;

					const fluxDispatcher = Object.values(wpRequire.c).find(
						(x: WebpackModule) => {
							if (!x?.exports?.Z) return false;
							const moduleExports = x.exports.Z as Record<string, unknown>;
							const proto = Object.getPrototypeOf(moduleExports) as Record<
								string,
								unknown
							>;
							return "flushWaitQueue" in proto;
						},
					)?.exports?.Z as FluxDispatcherType | undefined;
					if (!fluxDispatcher) throw new Error("Could not find FluxDispatcher");
					FluxDispatcher = fluxDispatcher;

					const apiClient = Object.values(wpRequire.c).find(
						(x: WebpackModule) => {
							if (!x?.exports?.tn) return false;
							const moduleExports = x.exports.tn as Record<string, unknown>;
							return "get" in moduleExports;
						},
					)?.exports?.tn as ApiClient | undefined;
					if (!apiClient) throw new Error("Could not find API");
					api = apiClient;

					console.log("All Discord stores loaded successfully");
				} catch (error) {
					console.error("Error loading Discord stores:", error);
					console.log("Please wait for Discord to fully load and try again.");
					return;
				}

				if (
					!QuestsStore ||
					!QuestsStore.quests ||
					QuestsStore.quests.size === 0
				) {
					console.log("No quests found. Please accept a quest first!");
					return;
				}

				const quests: DiscordQuest[] = [...QuestsStore.quests.values()].filter(
					(x: DiscordQuest) =>
						x.id !== "1412491570820812933" &&
						x.userStatus?.enrolledAt &&
						!x.userStatus?.completedAt &&
						new Date(x.config.expiresAt).getTime() > Date.now(),
				);

				const isApp = typeof window.DiscordNative !== "undefined";

				if (!isApp) {
					console.warn(
						"Not running in Discord desktop app. Some quest types may not work.",
					);
				}

				if (quests.length === 0) {
					console.log("You don't have any uncompleted quests!");
					return;
				}

				console.log(
					`Found ${quests.length} active quest(s). Starting multi-quest execution...`,
				);

				const questPromises = quests.map(
					async (quest: DiscordQuest): Promise<void> => {
						const pid =
							Math.floor(Math.random() * 30000) +
							1000 +
							Math.floor(Math.random() * 1000);

						const applicationId = quest.config.application.id;
						const questName = quest.config.messages.questName;
						const taskConfig =
							quest.config.taskConfig ?? quest.config.taskConfigV2;

						if (!taskConfig) {
							console.error(`No task config found for quest: ${questName}`);
							return;
						}

						const taskName = [
							"WATCH_VIDEO",
							"PLAY_ON_DESKTOP",
							"STREAM_ON_DESKTOP",
							"PLAY_ACTIVITY",
							"WATCH_VIDEO_ON_MOBILE",
						].find(
							(x) =>
								taskConfig.tasks[x as keyof typeof taskConfig.tasks] != null,
						);

						if (!taskName) {
							console.error(`No valid task found for quest: ${questName}`);
							return;
						}

						const taskDetail =
							taskConfig.tasks[taskName as keyof typeof taskConfig.tasks];
						if (!taskDetail) {
							console.error(`Task detail not found for: ${taskName}`);
							return;
						}

						const secondsNeeded = taskDetail.target;
						let secondsDone =
							quest.userStatus?.progress?.[taskName]?.value ?? 0;

						console.log(`Starting quest: ${questName} (${taskName})`);

						if (
							taskName === "WATCH_VIDEO" ||
							taskName === "WATCH_VIDEO_ON_MOBILE"
						) {
							const maxFuture = 10;
							const speed = 7;
							const interval = 1;

							if (!quest.userStatus) {
								console.error("Quest user status not found");
								return;
							}

							const enrolledAt = new Date(
								quest.userStatus.enrolledAt,
							).getTime();
							let completed = false;

							while (true) {
								const maxAllowed =
									Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
								const diff = maxAllowed - secondsDone;
								const timestamp = secondsDone + speed;

								if (diff >= speed) {
									const res = await (api.post({
										url: `/quests/${quest.id}/video-progress`,
										body: {
											timestamp: Math.min(
												secondsNeeded,
												timestamp + Math.random(),
											),
										},
									}) as Promise<ApiResponse<VideoProgressResponse>>);
									completed = res.body.completed_at != null;
									secondsDone = Math.min(secondsNeeded, timestamp);
								}

								if (timestamp >= secondsNeeded) {
									break;
								}
								await new Promise((resolve) =>
									setTimeout(resolve, interval * 1000),
								);
							}

							if (!completed) {
								await api.post({
									url: `/quests/${quest.id}/video-progress`,
									body: { timestamp: secondsNeeded },
								});
							}
							console.log(`Quest completed: ${questName}`);
						} else if (taskName === "PLAY_ON_DESKTOP") {
							console.log(
								`Attempting to complete ${questName} quest (PLAY_ON_DESKTOP)...`,
							);

							if (!isApp) {
								console.warn(
									"Running in browser mode. Using heartbeat method instead of spoofing.",
								);
								const streamKey = `call:${quest.id}:1`;

								while (true) {
									const res = await (api.post({
										url: `/quests/${quest.id}/heartbeat`,
										body: { stream_key: streamKey, terminal: false },
									}) as Promise<ApiResponse<HeartbeatResponse>>);
									const progress = res.body.progress.PLAY_ON_DESKTOP.value;
									console.log(
										`Quest progress (${questName}): ${progress}/${secondsNeeded}`,
									);

									await new Promise((resolve) =>
										setTimeout(resolve, 20 * 1000),
									);

									if (progress >= secondsNeeded) {
										await api.post({
											url: `/quests/${quest.id}/heartbeat`,
											body: { stream_key: streamKey, terminal: true },
										});
										break;
									}
								}

								console.log(`Quest completed: ${questName}`);
								return;
							}

							const appData: ApplicationData = await (api
								.get({
									url: `/applications/public?application_ids=${applicationId}`,
								})
								.then(
									(res) => (res as ApiResponse<ApplicationData[]>).body[0],
								) as Promise<ApplicationData>);

							const win32Executable = appData.executables.find(
								(x) => x.os === "win32",
							);
							if (!win32Executable) {
								console.error("No Windows executable found");
								return;
							}
							const exeName = win32Executable.name.replace(">", "");

							const fakeGame: FakeGame = {
								cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
								exeName,
								exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
								hidden: false,
								isLauncher: false,
								id: applicationId,
								name: appData.name,
								pid: pid,
								pidPath: [pid],
								processName: appData.name,
								start: Date.now(),
							};

							const realGames = RunningGameStore.getRunningGames();
							const fakeGames = [fakeGame];
							const realGetRunningGames = RunningGameStore.getRunningGames;
							const realGetGameForPID = RunningGameStore.getGameForPID;
							RunningGameStore.getRunningGames = (): FakeGame[] => fakeGames;
							RunningGameStore.getGameForPID = (
								pid: number,
							): FakeGame | undefined => fakeGames.find((x) => x.pid === pid);
							FluxDispatcher.dispatch({
								type: "RUNNING_GAMES_CHANGE",
								removed: realGames,
								added: [fakeGame],
								games: fakeGames,
							});

							return new Promise<void>((resolve): void => {
								const fn = (data: unknown): void => {
									const heartbeatData = data as HeartbeatData;
									const progress =
										quest.config.configVersion === 1
											? heartbeatData.userStatus.streamProgressSeconds
											: Math.floor(
													heartbeatData.userStatus.progress.PLAY_ON_DESKTOP
														.value,
												);

									if (!progress) return;

									console.log(
										`Quest progress (${questName}): ${progress}/${secondsNeeded}`,
									);

									if (progress >= secondsNeeded) {
										console.log(`Quest completed: ${questName}`);

										RunningGameStore.getRunningGames = realGetRunningGames;
										RunningGameStore.getGameForPID = realGetGameForPID;
										FluxDispatcher.dispatch({
											type: "RUNNING_GAMES_CHANGE",
											removed: [fakeGame],
											added: [],
											games: [],
										});
										FluxDispatcher.unsubscribe(
											"QUESTS_SEND_HEARTBEAT_SUCCESS",
											fn,
										);
										resolve();
									}
								};
								FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);

								console.log(
									`Spoofed your game for ${questName}. Wait for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`,
								);
							});
						} else if (taskName === "STREAM_ON_DESKTOP") {
							console.log(
								`Attempting to complete ${questName} quest (STREAM_ON_DESKTOP)...`,
							);

							if (!isApp) {
								console.warn(
									"Running in browser mode. Using heartbeat method instead of spoofing.",
								);
								const streamKey = `call:${quest.id}:1`;

								while (true) {
									const res = await (api.post({
										url: `/quests/${quest.id}/heartbeat`,
										body: { stream_key: streamKey, terminal: false },
									}) as Promise<ApiResponse<HeartbeatResponse>>);
									const progress = res.body.progress.STREAM_ON_DESKTOP.value;
									console.log(
										`Quest progress (${questName}): ${progress}/${secondsNeeded}`,
									);

									await new Promise((resolve) =>
										setTimeout(resolve, 20 * 1000),
									);

									if (progress >= secondsNeeded) {
										await api.post({
											url: `/quests/${quest.id}/heartbeat`,
											body: { stream_key: streamKey, terminal: true },
										});
										break;
									}
								}

								console.log(`Quest completed: ${questName}`);
								return;
							}

							const realFunc =
								ApplicationStreamingStore.getStreamerActiveStreamMetadata;
							ApplicationStreamingStore.getStreamerActiveStreamMetadata =
								(): ReturnType<
									typeof ApplicationStreamingStore.getStreamerActiveStreamMetadata
								> => ({
									id: applicationId,
									pid,
									sourceName: null,
								});

							return new Promise<void>((resolve): void => {
								const fn = (data: unknown): void => {
									const heartbeatData = data as HeartbeatData;
									const progress =
										quest.config.configVersion === 1
											? heartbeatData.userStatus.streamProgressSeconds
											: Math.floor(
													heartbeatData.userStatus.progress.STREAM_ON_DESKTOP
														.value,
												);

									if (!progress) return;

									console.log(
										`Quest progress (${questName}): ${progress}/${secondsNeeded}`,
									);

									if (progress >= secondsNeeded) {
										console.log(`Quest completed: ${questName}`);

										ApplicationStreamingStore.getStreamerActiveStreamMetadata =
											realFunc;
										FluxDispatcher.unsubscribe(
											"QUESTS_SEND_HEARTBEAT_SUCCESS",
											fn,
										);
										resolve();
									}
								};
								FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);

								console.log(
									`Spoofed your stream for ${questName}. Stream any window in vc for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`,
								);
								console.log(
									"Remember that you need at least 1 other person to be in the vc!",
								);
							});
						} else if (taskName === "PLAY_ACTIVITY") {
							console.log(
								`Attempting to complete ${questName} quest (PLAY_ACTIVITY)...`,
							);

							const channelId =
								ChannelStore.getSortedPrivateChannels()[0]?.id ??
								(() => {
									const guilds = Object.values(
										GuildChannelStore.getAllGuilds(),
									) as (GuildVocal | null)[];
									const guildWithVocal = guilds.find(
										(x) => (x?.VOCAL?.length ?? 0) > 0,
									);
									if (!guildWithVocal?.VOCAL?.[0]?.channel?.id) {
										throw new Error("No channel found for PLAY_ACTIVITY");
									}
									return guildWithVocal.VOCAL[0].channel.id;
								})();
							const streamKey = `call:${channelId}:1`;

							while (true) {
								const res = await (api.post({
									url: `/quests/${quest.id}/heartbeat`,
									body: { stream_key: streamKey, terminal: false },
								}) as Promise<ApiResponse<HeartbeatResponse>>);
								const progress = res.body.progress.PLAY_ACTIVITY.value;
								console.log(
									`Quest progress (${questName}): ${progress}/${secondsNeeded}`,
								);

								await new Promise((resolve) => setTimeout(resolve, 20 * 1000));

								if (progress >= secondsNeeded) {
									await api.post({
										url: `/quests/${quest.id}/heartbeat`,
										body: { stream_key: streamKey, terminal: true },
									});
									break;
								}
							}

							console.log(`Quest completed: ${questName}`);
						}
					},
				);

				await Promise.all(questPromises);
				console.log("All quests completed!");
			} catch (error) {
				console.error("Error running quest code:", error);
			}
		})();
	}

	waitForWebpack(runQuestCode);
})();
