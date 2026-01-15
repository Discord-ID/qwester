// Discord API Types
interface DiscordQuest {
	id: string;
	config: {
		application: {
			id: string;
			name: string;
		};
		messages: {
			questName: string;
		};
		expiresAt: string;
		configVersion?: number;
		taskConfig?: TaskConfig;
		taskConfigV2?: TaskConfig;
	};
	userStatus?: {
		enrolledAt: string;
		completedAt?: string;
		streamProgressSeconds?: number;
		progress?: {
			[key: string]: {
				value: number;
			};
		};
	};
}

interface TaskConfig {
	tasks: {
		WATCH_VIDEO?: TaskDetail;
		WATCH_VIDEO_ON_MOBILE?: TaskDetail;
		PLAY_ON_DESKTOP?: TaskDetail;
		STREAM_ON_DESKTOP?: TaskDetail;
		PLAY_ACTIVITY?: TaskDetail;
	};
}

interface TaskDetail {
	target: number;
}

interface FakeGame {
	cmdLine: string;
	exeName: string;
	exePath: string;
	hidden: boolean;
	isLauncher: boolean;
	id: string;
	name: string;
	pid: number;
	pidPath: number[];
	processName: string;
	start: number;
}

interface ApplicationData {
	name: string;
	executables: Array<{
		os: string;
		name: string;
	}>;
}

interface WebpackModule {
	exports?: {
		Z?: unknown;
		ZP?: unknown;
		tn?: unknown;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

interface WebpackRequire {
	c: Record<string, WebpackModule>;
	[key: string]: unknown;
}

interface StreamMetadata {
	id: string;
	pid: number;
	sourceName: string | null;
}

interface RunningGame {
	getRunningGames: () => FakeGame[];
	getGameForPID: (pid: number) => FakeGame | undefined;
}

interface QuestStore {
	quests: Map<string, DiscordQuest>;
	getQuest?: (id: string) => DiscordQuest | undefined;
}

interface Channel {
	id: string;
	[key: string]: unknown;
}

interface GuildVocal {
	VOCAL: Array<{
		channel: Channel;
	}>;
	[key: string]: unknown;
}

interface ApiClient {
	get: (options: { url: string }) => Promise<ApiResponse<unknown>>;
	post: (options: {
		url: string;
		body: Record<string, unknown>;
	}) => Promise<ApiResponse<unknown>>;
}

interface FluxDispatcherType {
	subscribe: (event: string, callback: (data: unknown) => void) => void;
	unsubscribe: (event: string, callback: (data: unknown) => void) => void;
	dispatch: (payload: Record<string, unknown>) => void;
}

interface ApiResponse<T = unknown> {
	body: T;
}

interface VideoProgressResponse {
	completed_at: string | null;
}

interface HeartbeatResponse {
	progress: {
		[key: string]: {
			value: number;
		};
	};
}

interface HeartbeatData {
	userStatus: {
		streamProgressSeconds?: number;
		progress: {
			[key: string]: {
				value: number;
			};
		};
	};
}

interface MessageResponse {
	success: boolean;
	error?: string;
}

declare global {
	interface Window {
		webpackChunkdiscord_app?: unknown[];
		$?: unknown;
		DiscordNative?: unknown;
	}
}

export type {
	DiscordQuest,
	TaskConfig,
	TaskDetail,
	FakeGame,
	ApplicationData,
	WebpackRequire,
	WebpackModule,
	ApiResponse,
	VideoProgressResponse,
	HeartbeatResponse,
	HeartbeatData,
	StreamMetadata,
	RunningGame,
	QuestStore,
	Channel,
	GuildVocal,
	ApiClient,
	FluxDispatcherType,
	MessageResponse,
};
