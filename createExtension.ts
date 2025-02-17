#!/usr/bin/env bun run
/**
 * createExtension.ts
 *
 * Usage: bun run createExtension.ts <DEFAULT_URL>
 * Example: bun run createExtension.ts "https://mail.google.com/?authuser=example@gmail.com#inbox"
 *
 * This script creates a Chrome extension in a folder named "quick-launch-<hostname>".
 * When the extension icon is clicked, it opens a configurable URL.
 *
 * The default bookmark target is the original URL provided.
 * However, the script fetches the page to resolve its hostname (and, in the case of Gmail,
 * to extract the "continue" URL) so that the favicon and extension name can be set based on that.
 *
 * The extension’s name will be "QuickLaunch: <hostname>".
 *
 * This version fetches a high-resolution (64px) favicon using Google's faviconV2 service.
 * It also loads supporting files (background.js, options.html, options.js) from a subfolder.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { URL } from 'url';

// __dirname equivalent for ES modules:
const __dirname = new URL('.', import.meta.url).pathname;

/**
 * Sanitizes a string for safe use as a folder name.
 */
function sanitizeForFilename(str: string): string {
  return str
    .replace(/[\/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Fetches the page to follow redirects and returns the hostname and a simple page title.
 * If the final URL is from accounts.google.com and contains a "continue" parameter,
 * we use that continue URL’s hostname for the favicon and naming.
 */
async function fetchPageData(url: string) {
  try {
    const response = await fetch(url);
    // Get the final URL after following redirects.
    const resolvedUrl = response.url;
    let resolvedParsed = new URL(resolvedUrl);
    let hostname = resolvedParsed.hostname;
    let pageTitle = hostname;

    // Check for Gmail redirection via accounts.google.com:
    if (hostname === 'accounts.google.com' && resolvedParsed.searchParams.has('continue')) {
      const continueParam = resolvedParsed.searchParams.get('continue');
      if (continueParam) {
        try {
          const continueUrl = new URL(continueParam);
          hostname = continueUrl.hostname;
          pageTitle = hostname;
        } catch (e) {
          // Parsing failed; keep the original hostname.
        }
      }
    }
    return { hostname, pageTitle };
  } catch (error) {
    console.error('Warning: Could not fetch or parse page data. Using fallback values.');
    const fallbackParsed = new URL(url);
    return {
      hostname: fallbackParsed.hostname,
      pageTitle: fallbackParsed.hostname,
    };
  }
}

async function main() {
  // Get the default URL from the command line.
  const inputUrl = process.argv[2];
  if (!inputUrl) {
    console.error('Error: No URL provided.\nUsage: bun run createExtension.ts <DEFAULT_URL>');
    process.exit(1);
  }

  // Validate the input URL.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(inputUrl);
  } catch (err) {
    console.error('Error: Invalid URL provided.');
    process.exit(1);
  }

  // Use the original URL as the bookmark target.
  const defaultTarget = inputUrl;

  // Fetch the page data to resolve the hostname (and possibly update it via a "continue" parameter).
  const { hostname, pageTitle } = await fetchPageData(inputUrl);

  // Build the high-resolution favicon URL (64px) using Google's faviconV2 service.
  const faviconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${hostname}&size=64`;

  // Sanitize the page title (which is now just the hostname) for folder naming.
  const safeTitle = sanitizeForFilename(pageTitle);
  const extensionDir = join(process.cwd(), `quick-launch-${safeTitle}`);

  // Create the extension folder if it doesn't exist.
  if (!existsSync(extensionDir)) {
    mkdirSync(extensionDir);
  }

  // Create manifest.json.
  const manifest = {
    manifest_version: 2,
    name: `QuickLaunch: ${pageTitle}`,
    version: '1.0',
    description: `Opens a configurable URL when clicked. Default: ${defaultTarget}`,
    browser_action: {
      default_title: `Go to ${pageTitle}`,
      default_icon: 'icon.png',
    },
    background: {
      scripts: ['background.js'],
      persistent: false,
    },
    options_page: 'options.html',
    permissions: ['tabs', 'storage'],
  };

  writeFileSync(join(extensionDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Read the background.js template, replace the placeholder, and write it.
  const bgTemplatePath = join(__dirname, 'extensionTemplates', 'background.js');
  let backgroundScript = readFileSync(bgTemplatePath, 'utf8');
  backgroundScript = backgroundScript.replace('__DEFAULT_URL__', defaultTarget);
  writeFileSync(join(extensionDir, 'background.js'), backgroundScript, 'utf8');

  // Copy options.html from the templates folder.
  const optionsHtmlPath = join(__dirname, 'extensionTemplates', 'options.html');
  const optionsHtml = readFileSync(optionsHtmlPath, 'utf8');
  writeFileSync(join(extensionDir, 'options.html'), optionsHtml, 'utf8');

  // Copy options.js from the templates folder.
  const optionsJsPath = join(__dirname, 'extensionTemplates', 'options.js');
  const optionsScript = readFileSync(optionsJsPath, 'utf8');
  writeFileSync(join(extensionDir, 'options.js'), optionsScript, 'utf8');

  // Download the high-resolution favicon and save it as icon.png.
  try {
    const response = await fetch(faviconUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch favicon. Status: ' + response.status);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(join(extensionDir, 'icon.png'), buffer);
    console.log(`Chrome extension created successfully in folder "${extensionDir}".`);
    console.log(
      'Load it in Chrome via chrome://extensions (with Developer Mode enabled) using "Load unpacked".'
    );
    console.log('Use the Options page to change the target URL.');
  } catch (error: any) {
    console.error('Error downloading favicon:', error.message);
    process.exit(1);
  }
}

main();
