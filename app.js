import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

const app = express();
app.use(cors());
app.use(express.json());

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

app.listen('5000', () => console.log('port 5000 listen'));

app.post('/participants', async (req, res) => {
  try {
    if (req.body.name === '') throw 422;

    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const isCreated = await db
      .collection('participants')
      .findOne({ name: req.body.name });

    if (isCreated !== null) throw 409;

    const date = Date.now();
    db.collection('participants').insertOne({
      name: req.body.name,
      lastStatus: date,
    });

    db.collection('messages').insertOne({
      from: req.body.name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs(date).format('HH:mm:ss'),
    });

    // db.collection('participants')
    //   .find()
    //   .toArray()
    //   .then((participants) => console.log(participants));

    res.sendStatus(201);
  } catch (error) {
    if (error === 422) res.status(422).send('O nome não pode ser vazio');
    if (error === 409)
      res.status(409).send('Este nome já está sendo utilizado');
    else res.sendStatus(500);
  }
});
