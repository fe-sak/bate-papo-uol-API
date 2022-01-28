import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import Joi from 'joi';

const app = express();
app.use(cors());
app.use(express.json());

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

app.listen('5000', () => console.log('port 5000 listen'));

app.post('/participants', async (req, res) => {
  const participantSchema = Joi.object({
    name: Joi.string().required(),
  });

  try {
    if (participantSchema.validate(req.body).error) {
      res.status(422).send('O nome não pode ser vazio');
      return;
    }

    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const isCreated = await db.collection('participants').findOne({ name: req.body.name });

    if (isCreated !== null) {
      res.status(409).send('Este nome já está sendo utilizado');
      return;
    }

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

    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.get('/participants', async (req, res) => {
  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const participants = await db.collection('participants').find({}).toArray();
    res.send(participants);
  } catch {
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});
