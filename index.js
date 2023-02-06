const express = require('express')
var bodyParser = require('body-parser')
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://<username>:<password>@<your-cluster-url>/test?retryWrites=true&w=majority";
// const uri = "mongodb://localhost:27017/irctc-demo";





const client = new MongoClient(uri);

const app = express()
const port = 3000



app.use(bodyParser.json())

app.get('/', (req, res) => {
    res.send('Hello World to IRCTC demo')
})


app.post('/v1/book-ticket', async (req, res) => {
    try {
        // count number of tickets already booked for that date
        let ticketCount = await client.db("irctc-demo")
            .collection("ticketsV1")
            .countDocuments({ date: req.body.date })


        if (ticketCount > 2) {
            return res.json({ message: `already full` })
        }


        // adding this line makes easy to test parallel requests
        await wait(10000)

        // book ticket for user
        const result = await client.db("irctc-demo")
            .collection("ticketsV1")
            .insertOne({ email: req.body.email, date: req.body.date });

        res.json({ id: result.insertedId })
    } catch (error) {
        console.log(error)
        res.json({ message: error.message })
    }
})

app.post('/v2/book-ticket', async (req, res) => {
    try {

        // decrement number of available tickets for a particular date with condition
        let ticketCount = await client.db("irctc-demo")
            .collection("ticketCountV2")
            .updateOne(
                { date: req.body.date, count: { $lt: 3 } },
                {
                    $inc: { count: 1 },
                },
            )

        if (ticketCount.modifiedCount == 0) {
            console.log(`request error`);
            return res.json({ message: 'false' })
        }

        // fake code to simulate random power failure
        let randomNumber = Math.random() * 2;
        if (randomNumber < 1) {
            throw new Error(`power failure`)
        }
        const result = await client.db("irctc-demo")
            .collection("ticketsV2")
            .insertOne({ email: req.body.email, date: req.body.date });
        return res.json({ id: result.insertedId, message: 'success' })


    } catch (error) {
        res.json({ message: error.message })
    }
})

app.post('/v3/book-ticket', async (req, res) => {
    const session = client.startSession();
    try {
        const transactionOptions = {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            readPreference: 'primary'
        };

        session.startTransaction(transactionOptions);

        // decrement number of available tickets for a particular date with condition
        let ticketCount = await client.db("irctc-demo").collection("ticketCountV3")
            .updateOne(
                { date: req.body.date, count: { $lt: 3 } },
                {
                    $inc: { count: 1 },
                }, {
                session
            }
            )

        if (ticketCount.modifiedCount == 0) {
            return res.json({ message: 'false' })
        }

        // fake code to simulate random power failure
        let randomNumber = Math.random() * 2;
        if (randomNumber < 1) {
            throw new Error(`some error`)
        }

        const result = await client.db("irctc-demo")
            .collection("ticketsV3")
            .insertOne({ email: req.body.email, date: req.body.date }, { session });

        await session.commitTransaction();

        return res.json({ id: result.insertedId, message: 'success' })

    } catch (error) {
        console.log(error)
        await session.abortTransaction();
        res.json({ message: error.message })
    } finally {
        await session.endSession();
    }
})

// app.post('/v2/register', async (req, res) => {
//   try {
//     const result = await client.db("irctc-demo").collection("usersV2").insertOne({email:req.body.email});
//     res.json({ message: `user registered successfully` })
//   } catch (error) {
//     console.error(error.message)
//     res.json({ message: error.message })
//   }
// })



function wait(timeout) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, timeout);
    })
}

client.connect().then(async () => {
    console.log(`connected to DB`);


    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })
})