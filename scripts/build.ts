import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function build() {
	console.log("🔨 Building Discord Quest Completer...");

	// Clean previous build
	console.log("🧹 Cleaning previous build...");
	if (existsSync("dist")) {
		await rm("dist", { recursive: true, force: true });
	}

	// Compile TypeScript
	console.log("⚙️  Compiling TypeScript...");
	try {
		await execAsync("bun tsc");
		console.log("✅ TypeScript compilation successful");
	} catch (error) {
		console.error("❌ TypeScript compilation failed:", error);
		process.exit(1);
	}

	// Copy assets
	console.log("📋 Copying assets...");
	try {
		// Copy manifest.json
		await cp("manifest.json", "dist/manifest.json");

		// Copy rules.json
		await cp("rules.json", "dist/rules.json");

		// Copy assets folder
		await cp("assets", "dist/assets", { recursive: true });

		console.log("✅ Assets copied successfully");
	} catch (error) {
		console.error("❌ Failed to copy assets:", error);
		process.exit(1);
	}

	console.log('✅ Build completed! Extension is ready in the "dist" folder.');
	console.log("📝 To load the extension:");
	console.log("   1. Open Chrome and go to chrome://extensions/");
	console.log('   2. Enable "Developer mode"');
	console.log('   3. Click "Load unpacked"');
	console.log('   4. Select the "dist" folder');
}

build().catch((error) => {
	console.error("❌ Build failed:", error);
	process.exit(1);
});
