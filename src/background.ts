chrome.runtime.onInstalled.addListener((): void => {
	console.log("Discord Quest Helper extension installed");
});

interface TabChangeInfo {
	status?: string;
}

chrome.tabs.onUpdated.addListener(
	(tabId: number, changeInfo: TabChangeInfo, tab: chrome.tabs.Tab): void => {
		if (
			changeInfo.status === "loading" &&
			tab.url &&
			tab.url.includes("discord.com")
		) {
			chrome.scripting
				.executeScript({
					target: { tabId: tabId },
					files: ["user-agent-override.js"],
					world: "MAIN",
				})
				.catch((): void => {});
		}
	},
);

interface ExecuteQuestCodeMessage {
	action: "executeQuestCode";
}

type MessageType = ExecuteQuestCodeMessage;

interface MessageResponse {
	success: boolean;
	error?: string;
}

chrome.runtime.onMessage.addListener(
	(
		request: MessageType,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: MessageResponse) => void,
	): boolean => {
		if (request.action === "executeQuestCode") {
			if (sender.tab?.id) {
				chrome.scripting
					.executeScript({
						target: { tabId: sender.tab.id },
						files: ["quest-code.js"],
						world: "MAIN",
					})
					.then((): void => {
						sendResponse({ success: true });
					})
					.catch((error: Error): void => {
						console.error("Error injecting quest code:", error);
						sendResponse({ success: false, error: error.message });
					});
			} else {
				sendResponse({ success: false, error: "No tab ID found" });
			}
			return true;
		}
		return false;
	},
);
