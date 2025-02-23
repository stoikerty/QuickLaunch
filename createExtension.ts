#!/usr/bin/env bun run
/**
 * createExtension.ts
 *
 * Usage: bun run createExtension.ts <DEFAULT_URL> [OPTIONAL_SUFFIX]
 * Example: bun run createExtension.ts "https://mail.google.com/?authuser=example@gmail.com#inbox" "beta"
 *
 * This script creates a Chrome extension in a folder named "quick-launch-<hostname>[-<suffix>]".
 * When the extension icon is clicked, it opens a configurable URL.
 *
 * The default bookmark target is the original URL provided.
 * However, the script fetches the page to resolve its hostname (and, in the case of Gmail,
 * to extract the "continue" URL) so that the favicon and extension name can be set based on that.
 *
 * The extension’s name will be "QuickLaunch: <hostname>" (with the suffix appended, if provided).
 *
 * This version fetches high-resolution favicons for multiple sizes (16px, 32px, 48px, 128px)
 * using Google's faviconV2 service.
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
  // Get the default URL and optional suffix from the command line.
  const inputUrl = process.argv[2];
  const suffixArg = process.argv[3] || '';
  if (!inputUrl) {
    console.error(
      'Error: No URL provided.\nUsage: bun run createExtension.ts <DEFAULT_URL> [OPTIONAL_SUFFIX]'
    );
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

  // Sanitize the page title and optional suffix for folder naming.
  const safeTitle = sanitizeForFilename(pageTitle);
  const safeSuffix = suffixArg ? sanitizeForFilename(suffixArg) : '';
  const folderSuffix = safeSuffix ? `-${safeSuffix}` : '';
  const extensionDir = join(process.cwd(), `quick-launch-${safeTitle}${folderSuffix}`);

  // Create the extension folder if it doesn't exist.
  if (!existsSync(extensionDir)) {
    mkdirSync(extensionDir);
  }

  // Define the icon sizes to fetch.
  const iconSizes = [16, 32, 48, 128];

  // Create manifest.json using Manifest V3 with defined icons.
  const extensionName = suffixArg
    ? `QuickLaunch: ${pageTitle} - ${suffixArg}`
    : `QuickLaunch: ${pageTitle}`;
  const manifest = {
    manifest_version: 3,
    name: extensionName,
    version: '1.0',
    description: `Opens a configurable URL when clicked. Default: ${defaultTarget}`,
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    action: {
      default_title: `Go to ${pageTitle}`,
      default_icon: {
        '16': 'icon-16.png',
        '32': 'icon-32.png',
        '48': 'icon-48.png',
        '128': 'icon-128.png',
      },
    },
    background: {
      service_worker: 'background.js',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: false,
    },
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

  // Fetch and save icons for each defined size.
  for (const size of iconSizes) {
    const iconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${hostname}&size=${size}`;
    try {
      const response = await fetch(iconUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch icon of size ${size}. Status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      writeFileSync(join(extensionDir, `icon-${size}.png`), buffer);
    } catch (error: any) {
      console.error(`Error downloading icon of size ${size}:`, error.message);
      process.exit(1);
    }
  }

  console.log(`Chrome extension created successfully in folder "${extensionDir}".`);
  console.log(
    'Load it in Chrome via chrome://extensions (with Developer Mode enabled) using "Load unpacked".'
  );
  console.log('Use the Options page to change the target URL.');
}

main();
