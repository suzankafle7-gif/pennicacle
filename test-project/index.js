import express from 'express';
const app = express();
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
app.get('/ping', (req, res) => {
    res.json({ pong: true });
});
app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
