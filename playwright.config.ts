import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		port: 4173
	},
	testDir: 'tests/e2e',
	reporter: [['html', { outputFolder: 'playwright-report' }]],
	projects: [
		{
			name: 'chromium-hd',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 1080 }
			}
		},
		{
			name: 'firefox-xga',
			use: {
				...devices['Desktop Firefox'],
				viewport: { width: 1024, height: 768 }
			}
		}
	],
	outputDir: 'test-results/'
});
