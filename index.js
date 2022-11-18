const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();

//Middle Ware //

app.use(cors());
app.use(express.json());

//MongoDb Connection//
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vhdpi0m.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized Access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        // Collections //
        const appointmentCollection = client.db('doctorsPortal').collection('appointment')
        const bookingsCollection = client.db('doctorsPortal').collection('bookings')
        const usersCollection = client.db('doctorsPortal').collection('users')
        // Appointment Data //
        app.get('/appointments', async (req, res) => {
            const date = req.query.date
            const query = {}
            const appointments = await appointmentCollection.find(query).toArray();

            // Get The Booking of the provided date //
            const bookingQuary = { appointmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuary).toArray()

            appointments.forEach(appointment => {
                const appointmentBooked = alreadyBooked.filter(book => book.treatment === appointment.name)
                const bookSlots = appointmentBooked.map(book => book.slot)
                const remainingSlots = appointment.slots.filter(slot => !bookSlots.includes(slot))
                appointment.slots = remainingSlots;
            })
            res.send(appointments);
        })
            // Dashboard Appointment //
            app.get('/bookings', verifyJWT, async (req, res) => {
                const email = req.query.email;
                const decodedEmail = req.decoded.email;
                if (email !== decodedEmail) {
                    return res.status(403).send({ message: 'Forbidden Access' })
                }
                const query = { email: email };
                const bookings = await bookingsCollection.find(query).toArray();
                res.send(bookings);
            })
            //    Booking Data //
            app.post('/bookings', async (req, res) => {
                const booking = req.body
                console.log(booking);
                const query = {
                    appointmentDate: booking.appointmentDate,
                    email: booking.email,
                    treatment: booking.treatment
                }
                const alreadyBooked = await bookingsCollection.find(query).toArray();
                console.log(booking);
                if (alreadyBooked.length) {
                    const message = `You Already have booked on ${booking.appointmentDate}`
                    return res.send({ acknowledged: false, message })
                }
                const result = await bookingsCollection.insertOne(booking);
                res.send(result);
            })
        //   JWT TOKen //
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
            console.log(user);
            res.send({ accessToken: 'token' })
        })

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
        // admin role //

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin'});
        })


        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result);
        })
    }
    finally {
    }
}

run().catch(console.log)


app.get('/', async (req, res) => {
    res.send('doctors portal server is running');
})
app.listen(port, () => console.log(`Doctors Portal Server is running on ${port}`));