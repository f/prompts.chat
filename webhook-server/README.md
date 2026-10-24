Setup and testing for the sample Facebook Messenger webhook

1) Install and run the server
   cd webhook-server
   npm init -y
   npm install express body-parser
n   # set a verify token and (optionally) PAGE_ACCESS_TOKEN
   set VERIFY_TOKEN=your_verify_token_here   # Windows PowerShell: $env:VERIFY_TOKEN = "..."
   set PAGE_ACCESS_TOKEN=your_page_access_token_here

   node server.js

2) Expose locally with ngrok (HTTPS required by Facebook)
   ngrok http 3000
   # copy the https URL (e.g. https://abcd1234.ngrok.io)

3) Configure the App (developers.facebook.com)
   - My Apps → Create App (choose Business or appropriate type)
   - App Dashboard → Add Product → Messenger → Set up
   - Under Webhooks: Callback URL = https://<NGROK_HOST>/webhook
                      Verify token = the same VERIFY_TOKEN you set
   - Subscribe to fields: messages, messaging_postbacks, messaging_optins, message_deliveries

4) Subscribe your Page to the app
   Using Graph API (replace PAGE_ID and PAGE_ACCESS_TOKEN):
   curl -X POST "https://graph.facebook.com/v17.0/PAGE_ID/subscribed_apps?access_token=PAGE_ACCESS_TOKEN"

5) Notes
   - In development mode the app only receives events for Pages where the app admin/tester is added.
   - To receive events from real users you must submit for App Review and switch the app live.
   - Implement Send API calls using the PAGE_ACCESS_TOKEN to reply to users.

If you want, update the server to send replies (I can add Send API example and a .env + npm scripts).