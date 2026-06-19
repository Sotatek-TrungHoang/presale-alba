import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AttributionService } from './attribution.service';

const APP_STORE_ID = '6749025396';
const ANDROID_PACKAGE = 'com.davros.alba';
const APP_STORE_URL = `https://apps.apple.com/gb/app/id${APP_STORE_ID}`;
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
// Reddit advertiser pixel id, from the Reddit Ads dashboard.
const REDDIT_PIXEL_ID = 'a2_j56yl6jokr7y';

/**
 * Generic entrypoint for marketing / campaign links.
 *
 * `GET /go?utm_source=...&utm_campaign=...` always renders a landing page that
 * opens the app (if installed) or sends the visitor to the right store. The
 * campaign params are logged server-side for web-click attribution and passed
 * through to the app via the custom scheme so the app-side capture sees them.
 */
@Controller('go')
export class GoController {
  constructor(private readonly attributionService: AttributionService) {}

  @Get()
  open(@Query() query: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    // Fire-and-forget: logging must never block or break the page.
    void this.attributionService.logClick({
      query,
      userAgent: req.get('user-agent') ?? undefined,
      referer: req.get('referer') ?? undefined,
    });

    const queryString = new URLSearchParams(query).toString();
    const deepLink = queryString ? `alba://?${queryString}` : 'alba://';
    const webUrl = `https://app.golfalba.co${req.originalUrl}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderLanding(deepLink, webUrl));
  }
}

function renderLanding(deepLink: string, webUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Alba — Golf, together</title>
  <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${webUrl}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Alba — Golf, together">
  <meta property="og:description" content="Find rounds, track scores and play more golf. Get the Alba app.">
  <meta property="og:image" content="https://app.golfalba.co/og-default.png">
  <meta property="og:url" content="${webUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <!-- Reddit Pixel -->
  <script>
    !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
    rdt('init','${REDDIT_PIXEL_ID}');
    rdt('track','PageVisit');
  </script>
  <!-- End Reddit Pixel -->
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{max-width:420px;width:100%;text-align:center}
    h1{font-size:26px;margin:0 0 12px}
    p{font-size:16px;line-height:1.5;color:#aaa;margin:0 0 24px}
    .divider{font-size:13px;color:#666;margin:24px 0 16px;text-transform:uppercase;letter-spacing:1px}
    .btn{display:block;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:12px}
    .btn-primary{background:#fff;color:#000}
    .btn-secondary{background:transparent;color:#fff;border:1px solid #333}
  </style>
</head>
<body>
  <div class="card">
    <h1>Golf, together</h1>
    <p>If you have Alba installed, tap below to open it. Otherwise, grab the app to get started.</p>
    <a class="btn btn-primary" href="${deepLink}" onclick="rdt('track','Lead',{customEventName:'open_app'})">Open in Alba</a>
    <div class="divider">Don't have the app?</div>
    <a class="btn btn-secondary" href="${APP_STORE_URL}" onclick="rdt('track','Lead',{customEventName:'download_ios'})">Download on the App Store</a>
    <a class="btn btn-secondary" href="${PLAY_STORE_URL}" onclick="rdt('track','Lead',{customEventName:'download_android'})">Get it on Google Play</a>
  </div>
</body>
</html>`;
}
