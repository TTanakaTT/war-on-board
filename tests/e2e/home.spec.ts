import { SpecBase } from './specBase';

const base = new SpecBase('home');

base.runTest(async ({ page }) => {
	await base.compareScreenshot(page, '0-0.png');

	await base.compareScreenshot(page, '1-0.png');

	await page.getByRole('banner').getByRole('button').hover();
	await base.compareScreenshot(page, '1-1.png');

	await page.getByRole('banner').getByRole('button').click();
	await base.compareScreenshot(page, '1-2.png');

	await page.getByRole('button', { name: 'ja' }).hover();
	await base.compareScreenshot(page, '1-3.png');

	await page.getByRole('button', { name: 'ja' }).click();
	await base.compareScreenshot(page, '1-4.png');

	await base.compareScreenshot(page, '2-0.png');

	await page.getByRole('button', { name: '生産' }).hover();
	await base.compareScreenshot(page, '2-1.png');

	await page.getByRole('button', { name: '生産' }).click();
	await base.compareScreenshot(page, '2-2.png');

	await page.locator(".pseudo-el\\:content-\\[\\'\\'\\]").first().hover();
	await base.compareScreenshot(page, '2-3.png');

	await page.locator(".pseudo-el\\:content-\\[\\'\\'\\]").first().click();
	await base.compareScreenshot(page, '2-4.png');

	await page.locator("div:nth-child(2) > div > .pseudo-el\\:content-\\[\\'\\'\\]").first().hover();
	await base.compareScreenshot(page, '2-5.png');

	await page.locator("div:nth-child(2) > div > .pseudo-el\\:content-\\[\\'\\'\\]").first().click();
	await base.compareScreenshot(page, '2-6.png');

	await page.locator("div:nth-child(2) > div > .pseudo-el\\:content-\\[\\'\\'\\]").first().click();
	await base.compareScreenshot(page, '2-7.png');

	await page
		.locator("div:nth-child(3) > div:nth-child(2) > .pseudo-el\\:content-\\[\\'\\'\\]")
		.click();
	await base.compareScreenshot(page, '2-8.png');

	await page
		.locator("div:nth-child(3) > div:nth-child(2) > .pseudo-el\\:content-\\[\\'\\'\\]")
		.click();
	await base.compareScreenshot(page, '2-9.png');

	await page
		.locator("div:nth-child(3) > div:nth-child(2) > .pseudo-el\\:content-\\[\\'\\'\\]")
		.click();
	await base.compareScreenshot(page, '2-10.png');
});
