// src/round/round.controller.ts
import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';

const APP_STORE_ID = '6749025396';
const ANDROID_PACKAGE = 'com.davros.alba';

@Controller('round')
export class RoundController {
  @Get(':id')
  landing(@Param('id') id: string, @Res() res: Response) {
    const safeId = id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderLanding(safeId));
  }
}

function renderLanding(id: string): string {
  const url = `https://app.golfalba.co/round/${id}`;
  const deepLink = `alba://round/${id}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Join a round on Alba</title>
  <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${url}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Join a round on Alba">
  <meta property="og:description" content="You've been invited to a round of golf. Tap to view it in the Alba app.">
  <meta property="og:image" content="https://app.golfalba.co/og-default.png">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary_large_image">
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
    <h1>You've been invited to a round</h1>
    <p>If you have Alba installed, this link should open the app automatically.</p>
    <a class="btn btn-primary" href="${deepLink}">Open in Alba</a>
    <div class="divider">Don't have the app?</div>
    <a class="btn btn-secondary" href="https://apps.apple.com/gb/app/id${APP_STORE_ID}">Download on the App Store</a>
    <a class="btn btn-secondary" href="https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}">Get it on Google Play</a>
  </div>
</body>
</html>`;
}
