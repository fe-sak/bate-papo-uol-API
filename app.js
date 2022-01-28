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

app.get('/messages', async (req, res) => {
  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    let messages = await db
      .collection('messages')
      .find({
        $or: [
          { type: 'message' },
          {
            $or: [
              { type: 'private_message', to: req.headers.user },
              { type: 'private_message', from: req.headers.user },
            ],
          },
        ],
      })
      .toArray();

    messages = messages.slice(req.query.limit ? parseInt(req.query.limit) * -1 : 0);
    res.send(messages);
  } catch {
    res.sendStatus(500);
  } finally {
  }
});

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

    if (isCreated) {
      res.status(409).send('Este nome já está sendo utilizado');
      return;
    }

    const date = Date.now();

    await db.collection('participants').insertOne({
      name: req.body.name,
      lastStatus: date,
    });

    await db.collection('messages').insertOne({
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

app.post('/messages', async (req, res) => {
  const messageSchema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required().valid('message', 'private_message'),
  });

  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const participant = await db.collection('participants').findOne({ name: req.headers.user });
    if (!participant) {
      res.status(404).send('Participante não encontrado');
      return;
    }

    const message = { ...req.body, from: req.headers.user };
    const validate = messageSchema.validate(message, { abortEarly: false });

    if (validate.error) {
      res.status(422).send(validate.error.details.map((detail) => detail.message));
      return;
    }

    await db
      .collection('messages')
      .insertOne({ ...message, time: dayjs(Date.now()).format('HH:mm:ss') });
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.post('/status', async (req, res) => {
  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const filter = { name: req.headers.user };

    const participant = await db.collection('participants').findOne(filter);
    if (!participant) {
      res.sendStatus(404);
      return;
    }

    const updateDoc = {
      $set: {
        lastStatus: Date.now(),
      },
    };

    await db.collection('participants').updateOne(filter, updateDoc);

    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});
