import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import Joi from 'joi';
import { stripHtml } from 'string-strip-html';

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

    res.send(await db.collection('participants').find().toArray());
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
          { type: 'status' },
          { type: 'private_message', to: req.headers.user },
          { type: 'private_message', from: req.headers.user },
        ],
      })
      .toArray();

    res.send(messages.slice(req.query.limit ? parseInt(req.query.limit) * -1 : 0));
  } catch {
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.post('/participants', async (req, res) => {
  const fromSchema = Joi.object({
    name: Joi.string().required(),
  });
  const validate = fromSchema.validate(req.body, { abortEarly: false });
  if (validate.error) {
    res.status(422).send(validate.error.details.map((detail) => detail.message));
    return;
  }
  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const name = stripAndTrim(req.body.name);
    const date = Date.now();

    const isCreated = await db.collection('participants').findOne({ name });
    if (isCreated) {
      res.status(409).send('Este nome já está sendo utilizado');
      return;
    }

    await db.collection('participants').insertOne({
      name,
      lastStatus: date,
    });

    await db.collection('messages').insertOne({
      from: name,
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
  const message = { ...req.body, from: req.headers.user };
  const messageSchema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required().valid('message', 'private_message'),
  });
  const validate = messageSchema.validate(message, { abortEarly: false });
  if (validate.error) {
    res.status(422).send(validate.error.details.map((detail) => detail.message));
    return;
  }
  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const from = await db.collection('participants').findOne({ name: req.headers.user });
    if (!from) {
      res.status(404).send('Participante não encontrado');
      return;
    }

    const to = await db.collection('participants').findOne({ name: req.body.to });
    if (!to) {
      res.status(404).send('Destinatário não encontrado');
      return;
    }

    await db
      .collection('messages')
      .insertOne({ ...sanitizeObject(message), time: dayjs(Date.now()).format('HH:mm:ss') });
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
    const updateDoc = {
      $set: {
        lastStatus: Date.now(),
      },
    };

    const participant = await db.collection('participants').findOne(filter);
    if (!participant) {
      res.sendStatus(404);
      return;
    }

    await db.collection('participants').updateOne(filter, updateDoc);

    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.put('/messages/:messageId', async (req, res) => {
  const messageId = req.params.messageId;
  if (messageId.length !== 24) {
    res.status(422).send('Formato do Id inválido, envie um hexadecimal de 24 dígitos');
  }

  const messageSchema = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required().valid('message', 'private_message'),
  });
  const validate = messageSchema.validate(req.body, { abortEarly: false });
  if (validate.error) {
    res.status(422).send(validate.error.details.map((detail) => detail.message));
    return;
  }

  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const filter = { _id: new ObjectId(messageId) };
    const updateDoc = { $set: { ...req.body, time: dayjs(Date.now()).format('HH:mm:ss') } };

    const from = await db.collection('participants').findOne({ name: req.headers.user });
    if (!from) {
      res.sendStatus(404);
      return;
    }

    const message = await db.collection('messages').findOne(filter);
    if (!message) {
      res.sendStatus(404);
      return;
    }

    if (message.from !== stripAndTrim(req.headers.user)) {
      res.send(401);
      return;
    }

    await db.collection('messages').updateOne(filter, updateDoc);

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.delete('/messages/:messageId', async (req, res) => {
  const messageId = req.params.messageId;
  if (messageId.length !== 24) {
    res.status(422).send('Formato do Id inválido, envie um hexadecimal de 24 dígitos');
  }
  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    const participant = await db.collection('participants').findOne({ name: req.headers.user });
    if (!participant) {
      res.sendStatus(404);
      return;
    }

    const message = await db.collection('messages').findOne({ _id: new ObjectId(messageId) });
    if (!message) {
      res.sendStatus(404);
      return;
    }

    if (message.from !== stripAndTrim(req.headers.user)) {
      res.send(401);
      return;
    }
    await db.collection('messages').deleteOne({ _id: new ObjectId(messageId) });

    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

async function updateParticipants() {
  try {
    await mongoClient.connect();
    db = mongoClient.db('bate-papo-uol-API');

    let participants = await db.collection('participants').find().toArray();

    participants.forEach((participant) => {
      if (Date.now() - participant.lastStatus > 10000) {
        db.collection('participants').deleteOne({ _id: new ObjectId(participant._id) });
        db.collection('messages').insertOne({
          from: participant.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs(Date.now()).format('HH:mm:ss'),
        });
      }
    });
  } catch (error) {
    console.log(error);
  }
}
setInterval(updateParticipants, 1000);

function stripAndTrim(string) {
  return stripHtml(string).result.trim();
}

function sanitizeObject(object) {
  Object.keys(object).forEach((key) => (object[key] = stripAndTrim(object[key])));

  return object;
}
