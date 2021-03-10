# Jarvis330
[![Badge](https://img.shields.io/badge/Javascript-brightgreen.svg)](https://github.com/AndrewB330/)
<!--[![Badge](https://europe-west6-xlocc-badge.cloudfunctions.net/XLOCC/AndrewB330/Jarvis330)](https://github.com/AndrewB330/)-->

**Jarvis330** - automatically manages everything I want. Not very creative name, I know.

#### Features:
- Common interface for crypto exchanges
- Interface for creating custom trading bots
  - Implemented accumulation bot (buy a constant amount of crypto every day)
- Telegram notifications (daily, and for important events)
- Chart generation (in development)
- Market anomaly detection
- Firebase RDB connection

## How to start
To start **Jarvis330** you should create `config.json` file (example: `config.example.json`)
Right now only accumulation bot is available, steps to set up:
1. Binance
    1. Register on binance
    2. Transfer some amount of stablecoins to account (USDT, BUSD, TUSD etc.)
    3. Create API and cope api key and secret key to `config.json`
2. Telegram
    1. Create a new bot with @BotFather, copy token to config
    2. Copy id from @userinfobot
3. Firebase
    1. Register on firebase
    2. Create a new project
    3. Start realtime database
    4. Go to settings (gear icon) > Project settings > Service accounts
    5. Click "create new private key", download it
    6. Copy file content to "credentials" field
4. Install everything with `npm install`
5. Run bot with `npm run release`
