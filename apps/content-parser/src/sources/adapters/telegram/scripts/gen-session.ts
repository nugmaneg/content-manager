import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';

const apiId = Number('35300988');
const apiHash = 'd1a5c4c9cc9e661f7a43ca46c79933bf+';
const stringSession = new StringSession(process.env.TG_MAIN_SESSION || '');

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: () => input.text('Phone (+...): '),
    password: () => input.text('2FA password (if any): '),
    phoneCode: () => input.text('Code: '),
    onError: (err) => console.error(err),
  });
  console.log('New session string:\n', client.session.save());
  await client.disconnect();
})();
