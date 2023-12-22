const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();

//Middle Ware //

//sms
var sid = "ACdf72c3cba389e7fb77455a84bf23271d";
var auth_token = "c02cea388b803665f0862e6e42304291";
var twilio = require("twilio")(sid, auth_token);

app.use(cors());
app.use(express.json());

//MongoDb Connection//
const uri = `mongodb+srv://naimuronik24:U5WLovyjI2SPnh4u@cluster0.hysr1in.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// function verifyJWT(req, res, next) {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) {
//         return res.status(401).send('Unauthorized Access');
//     }
//     const token = authHeader.split(' ')[1];

//     jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
//         if (err) {
//             return res.status(403).send({ message: 'Forbidden Access' })
//         }
//         req.decoded = decoded;
//         next();
//     })
// }

async function run() {
  try {
    // Collections //
    const appointmentCollection = client
      .db("doctorsPortal")
      .collection("appointment");
    const bookingsCollection = client
      .db("doctorsPortal")
      .collection("bookings");
    const usersCollection = client.db("doctorsPortal").collection("users");
    const doctorsCollection = client.db("doctorsPortal").collection("doctors");

    // // Make sure u run verifyadmin after JWT //
    // const verifyAdmin = async ( req, res, next ) => {
    //     console.log('inside verifyAdmin', req.decoded.email);
    //     const decodedEmail = req.decoded.email;
    //     const query = { email : decodedEmail};
    //     const user = await usersCollection.findOne(query)
    //     if(user?.role !== 'admin'){
    //         return res.status(403).send({ message: 'Forbidden Access'})
    //     }
    //     next();
    // }
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });
    // Appointment Data //
    app.get("/appointments", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const appointments = await appointmentCollection.find(query).toArray();

      // Get The Booking of the provided date //
      const bookingQuary = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection
        .find(bookingQuary)
        .toArray();

      appointments.forEach((appointment) => {
        const appointmentBooked = alreadyBooked.filter(
          (book) => book.treatment === appointment.name
        );
        const bookSlots = appointmentBooked.map((book) => book.slot);
        const remainingSlots = appointment.slots.filter(
          (slot) => !bookSlots.includes(slot)
        );
        appointment.slots = remainingSlots;
      });
      res.send(appointments);
    });
    // Dashboard Appointment //

    app.get("/bookings", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    //    Booking Data //
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      //console.log(booking);
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
        doctor: booking.doctor,
        hospital: booking.hospital,
      };
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      //const doctor= await doctorsCollection.find(booking.treatment).toArray();
      //console.log(booking);
      if (alreadyBooked.length) {
        const message = `You Already have booked on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      //console.log("Booking");
      const result = await bookingsCollection.insertOne(booking);
      twilio.messages
        .create({
          from: "+12056773656",
          to: "+8801727985815",
          body: `${booking.patient} booking for an appointment at ${booking.appointmentDate} and patient number is ${booking.phone}`,
        })
        .then(function (res) {
          console.log("message has sent!");
        })
        .catch(function (err) {
          console.log(err);
        });

      res.send(result);
    });
    //   JWT TOKen //
    // app.get('/jwt', async (req, res) => {
    //     const email = req.query.email;
    //     const query = { email: email };
    //     const user = await usersCollection.findOne(query)
    //     if (user) {
    //         const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
    //         return res.send({ accessToken: token })
    //     }
    //     res.status(403).send({ accessToken: '' })
    //     console.log(user);
    //     res.send({ accessToken: 'token' })
    // })

    // selected data from mongoDB //
    app.get("/appointmentSpecialty", async (req, res) => {
      const query = {};
      const result = await appointmentCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      //console.log(user);
      const result = await usersCollection.insertOne(user);
      //console.log(user);
      res.send(result);
    });
    // admin role //

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const role = req.params.role;
      const user = await usersCollection.findOne(query);
      console.log(user);
      res.send({ isAdmin: user?.role === "admin" });
    });

    // app.put("/users/admin/:email", async (req, res) => {
    //   console.log(req.params.phone);
    //   console.log('hello');
    //   const Email = req.params.email;
    //   const query = { email: Email };
    //   //console.log(query);
    //   const user = await usersCollection.findOne(query);
    //   //console.log(user?.phone);
    //   if (user?.role !== "admin") {
    //     //console.log("Hello world");
    //     return res.status(403).send({ message: "Forbidden Access" });
    //   }
    //   const id = req.params.id;
    //   const filter = { _id: ObjectId(id) };
    //   const options = { upsert: true };
    //   const updateDoc = {
    //     $set: {
    //       role: "admin",
    //     },
    //   };
    //   console.log("hello");
    //   const result = await usersCollection.updateOne(
    //     filter,
    //     updateDoc,
    //     options
    //   );
    //   res.send(result);
    // });

    app.put("/users/admin/:id", async (req, res) => {
      //console.log(req.params);
      const decodedEmail = req.params.id;
      console.log(decodedEmail);
      const query = { email: decodedEmail };
      console.log(query);
      const user = await usersCollection.findOne(query);
      console.log(user);
      // if (user?.role !== "admin") {
      //   return res.status(403).send({ message: "Forbidden Access" });
      // }

      const idd = user.id;
      const filter = { _id: ObjectId(idd) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          id:filter,
          name:user.name,
          email:user.email,         
          role: "admin",
        },
      };
      console.log(filter,options,updateDoc);
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // doctor collection

    app.get("/doctors", async (req, res) => {
      const query = {};
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors);
    });

    app.post("/doctors", async (req, res) => {
      const doctor = req.body;
      console.log(doctor);
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });
    // delete doctor

    app.delete("/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});
app.listen(port, () =>
  console.log(`Doctors Portal Server is running on ${port}`)
);
