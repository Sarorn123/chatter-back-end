require("dotenv").config();

import express, { Request, Response } from 'express';
import http from 'http';
import bodyParser from 'body-parser';
import cors from 'cors';
import { ICreateUser } from './interface/IUser';
import * as bcrypt from "bcrypt"
import mongoose from 'mongoose';
import { Server } from "socket.io";

// model 
import User from "./Model/User";
import Message from './Model/Message';


const app = express();
app.use(cors({
  credentials: true,
}));
app.use(bodyParser.json());

mongoose.set('strictQuery', true);
// conntect db 
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("DB Connetion Successfull");
  })
  .catch((err) => {
    console.log(err.message);
  });


// auth 
app.post("/register", async (req: Request, res: Response) => {
  const { username, password, avatar, email }: ICreateUser = req.body;
  if (!username) return res.status(400).json({ message: "username is required !" });
  if (!password) return res.status(400).json({ message: "password is required !" });
  if (!avatar) return res.status(400).json({ message: "avatar is required !" });
  if (!email) return res.status(400).json({ message: "email is required !" });

  const user = await User.findOne({
    username: username
  });

  if (user) return res.status(400).json({ message: "username taken !" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ username, avatar, password: hash, email });
    res.json({ message: "create success" })

  } catch (error) {
    res.status(400).json({ message: error.message })
  }
});

app.post("/login", async (req: Request, res: Response) => {
  const { username, password }: ICreateUser = req.body;
  if (!username) return res.status(400).json({ message: "username is required !" });
  if (!password) return res.status(400).json({ message: "password is required !" });

  const user = await User.findOne({
    username: username
  });

  if (!user) return res.status(400).json({ message: "user not found !" });

  try {
    const compare = await bcrypt.compare(password, user.password);
    if (!compare) return res.status(400).json({ message: "password not correct !" });
    user.password = undefined
    res.json({ user });

  } catch (error) {
    res.status(400).json({ message: error.message })
  }
});

app.post("/get-all-user/:id", async (req: Request, res: Response) => {

  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "params is required !" });

  try {

    const users = await User.find({ _id: { $ne: id } }).select([
      "_id",
      "username",
      "avatar",
    ]);

    return res.json({ users });
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
});

app.post("/get-message", async (req: Request, res: Response) => {

  const { from, to }: { from: string, to: string } = req.body;
  if (!from) return res.status(400).json({ message: "from is required !" });
  if (!to) return res.status(400).json({ message: "to is required !" });
  try {
    const messages = await Message.find({
      users: {
        $all: [from, to],
      },
    }).sort({ updatedAt: 1 });

    const chatMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender.toString() === from,
        message: msg.message,
        createdAt: msg.createdAt,
        image: msg.image
      };
    });
    res.json(chatMessages);

  } catch (error) {
    res.status(400).json({ message: error.message })
  }
});

app.post("/add-message", async (req: Request, res: Response) => {

  const { from, to, message, image }: { from: string, to: string, message: string, image: string } = req.body;
  if (!from) return res.status(400).json({ message: "from is required !" });
  if (!to) return res.status(400).json({ message: "to is required !" });
  try {
    const data = await Message.create({
      message: message,
      image: image,
      users: [from, to],
      sender: from,
    });

    if (data) return res.json({ msg: "Message added successfully." });
    else return res.json({ msg: "Failed to add message to the database" });
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "https://chatter-front-end.vercel.app"]
  }
});

interface IOnlineUser {
  userId: string
  socketId: string
}
interface IMessage {
  fromSelf: boolean;
  message: string;
  createdAt: string;
  image: string;
  to?: string;
}


let onlineUsers: IOnlineUser[] = [];

io.on("connection", (socket) => {
  socket.on("add-user", (userId: string) => {
    onlineUsers.push({
      userId,
      socketId: socket.id
    });
    // emit online user back to client 
    io.emit("online-users", onlineUsers);
  });

  socket.on("sent-message", (data: IMessage) => {

    const toUserIsOnline = onlineUsers.find(sendTo => sendTo.userId === data.to);
    if (toUserIsOnline) {
      socket.to(toUserIsOnline.socketId).emit("receive-message", data);
    }
  });

  socket.on("logout", (userId: string) => {
    onlineUsers = onlineUsers.filter((user) => user.socketId !== userId);
    io.emit("online-users", onlineUsers);
  })

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    io.emit("online-users", onlineUsers);
  });
});




httpServer.listen(process.env.PORT || 5000, () => {
  console.log('Server running on 5000');
});