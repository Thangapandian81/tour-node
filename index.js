const express = require('express');
const router=express.Router()
const bodyParser = require('body-parser');
const {db} = require('./config/firebaseConfig')

const app = express();

app.use(bodyParser.json());

const verifEmailRoutes=require('./routes/verify')
const packageRoutes=require('./routes/packages/package')
const categoryRoutes=require('./routes/packages/category')
const createLeadRoutes=require('./routes/createLead')
const bookingRoutes= require('./routes/booking')
// const searchRoutes=require('./routes/search')
const authRoutes=require('./routes/auth');
const striptRoutes=require('./routes/stripe')
const mailRoutes=require('./routes/mail')
const findRoutes=require('./routes/findpackages')
const razorRoutes=require('./routes/razor')
const { auth } = require('firebase-admin');


app.use('/verify',verifEmailRoutes);
app.use('/packages',packageRoutes)
app.use('/category',categoryRoutes)
app.use('/lead',createLeadRoutes)
app.use('/book',bookingRoutes)
// app.use('/search',searchRoutes)
app.use('/auth',authRoutes)
app.use('/stripe',striptRoutes)
app.use('/mail',mailRoutes)
app.use('/find',findRoutes)
app.use('/razor'razorRoutes)


// app.post("/sample",async (req,res)=>{
//     const data=req.body; 
//     await db.collection("booking").add(data)
//     if (res.statusCode==200)
//     {
//         res.send({msg:"jechitom mara!"})
//     }
//     else{
//         res.send({msg:"vanakam da mapla else la irrunthu"})
//     }
// }) 

// app.get('/get-user',async(req,res)=>{
//     const data= await db.collection("visitors").get();
//     const list=data.docs.map((doc)=> ({id:doc.id, ...doc.data()}))
//     res.send(list)
// })
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 3000
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});