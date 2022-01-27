import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
app.use(cors());

app.listen('5000', () => console.log('port 5000 listen'));

app.get('/participants', (req, res) => {
  res.send('A');
});
