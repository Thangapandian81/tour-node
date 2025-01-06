const express = require('express');
const bodyParser = require('body-parser');
const {db}=require('../../config/firebaseConfig')
const router = express.Router();

const app = express();

app.use(bodyParser.json());

router.post('/add-category',async (req,res)=>{
    const data = req.body;
const currentTimestamp = new Date().toISOString();

try {
    const lastDocSnapshot = await db.collection("category")
        .orderBy("cat_id", "desc")
        .limit(1)
        .get();
    
    let nextCatId = 1; 
    if (!lastDocSnapshot.empty) {
        const lastCatId = lastDocSnapshot.docs[0].data().cat_id;
        nextCatId = lastCatId + 1;
    }
    
    const newCategory = {
        cat_id: nextCatId,
        cat_name: data.cat_name,
        created_at: currentTimestamp
    };

    await db.collection("category").add(newCategory);
    res.status(200).send({ msg: "Category added!", status: "200" });
} catch (error) {
    console.error("Error adding category:", error);
    res.status(400).send({ msg: "Category not added!", status: "400", error: error.message });
}

    
})

// router.get('/get-category',async(req,res)=>{
//     const data= await db.collection("category").get();
//     const list=data.docs.map((doc)=> ({id:doc.id, ...doc.data()}))
//     res.send(list)
// })

router.post('/update-category',async(req,res)=>{
    const cat_id = req.body.cat_id;
const data = req.body;

try {
    const categorySnapshot = await db.collection("category")
        .where("cat_id", "==", cat_id)
        .limit(1)
        .get();

    if (!categorySnapshot.empty) {
        const docId = categorySnapshot.docs[0].id;

        await db.collection("category").doc(docId).update(data);

        res.status(200).send({ msg: "Category updated successfully!" });
    } else {
        res.status(404).send({ msg: "Category not found!" });
    }
} catch (error) {
    console.error("Error updating category:", error);
    res.status(500).send({ msg: "Category update failed!", error: error.message });
}


})

router.post('/delete-category',async(req,res)=>{
    const cat_id = req.body.cat_id;

try {
    const categorySnapshot = await db.collection("category")
        .where("cat_id", "==", cat_id)
        .limit(1)
        .get();

    if (!categorySnapshot.empty) {
        const docId = categorySnapshot.docs[0].id;
        await db.collection("category").doc(docId).delete();
        res.status(200).send({ msg: "Category deleted successfully!" });
    } else {
        res.status(404).send({ msg: "Category not found!" });
    }
} catch (error) {
    res.status(500).send({ msg: "Category deletion failed!", error: error.message });
}

})

module.exports = router