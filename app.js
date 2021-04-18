const express = require('express');
const app = express();
const port = 3000;

let axios = require('axios');
let cheerio = require('cheerio');


let rec = [];
let dictionary = {};


let interval1 = null;
let interval2 = null;


let getFileAttributeAttempt = {attempt:3,axiosCancelToken:null,param:{}};
let getFolderAttempt        = {attempt:3,axiosCancelToken:null,param:{}};



const getFileAttribute = async url => {
    try {

      console.log("Reaching file's attributes at " +url);

      getFileAttributeAttempt.attempt=3;
      getFileAttributeAttempt.param.url=url;
      getFileAttributeAttempt.axiosCancelToken = axios.CancelToken.source();

      res = await axios.get("https://github.com"+url);
      const html = res.data;
      const $ = cheerio.load(html); 

      var m = $("[data-target='readme-toc.content']").find(".text-mono").text().trim().split(" ");

      var linesIndex = m.indexOf("lines");

      let size  = parseFloat(m[m.length-2].trim());
      let bytes = 0;
      
      switch(m[m.length-1].trim().toLowerCase()){
        case 'kb':
          bytes = size*1024;
          break
        case 'mb':
          bytes = size*Math.pow(1024,2)
          break;
      }


      return {lines:parseInt(m[linesIndex-1].trim()),bytes:bytes}

    } catch (e) {
      

      // console.log(e);
      console.log("Waiting to try again");

      getFileAttributeAttempt.axiosCancelToken.cancel();

      clearTimeout(interval1);

      interval1 = setTimeout(async () => {
        
        console.log("...retrying...");
        
        await getFileAttribute(getFileAttributeAttempt.param.url);
      }, 3000);


    }


  
}

const getFolder = async url => {
    
    try {
      console.log('Reading directory at '+url);


      getFolderAttempt.attempt=3;
      getFolderAttempt.param.url=url;
      getFolderAttempt.axiosCancelToken = axios.CancelToken.source();

      res = await axios.get(url);

      const html = res.data;

      await readFiles(html);

    } catch (e) {
      // console.log(e);
      
      console.log("Waiting to try again");
      getFolderAttempt.axiosCancelToken.cancel();
      clearTimeout(interval2);
      interval2 = setTimeout(async () => {
        console.log("...retrying...");
        
        await getFolder(getFolderAttempt.param.url)
      }, 3000);
    
    }
}


const readFiles = async (html) => {

  const $ = cheerio.load(html); 
  var ar = $('.Box.mb-3').find('.js-details-container.Details').find('.Box-row');

  var name      = "";
  var extension = "";

  var type = "";

  for (let index = 0; index < ar.length; index++) {

    type = ar.eq(index).find("[aria-label]").attr("aria-label")

    name = ar.eq(index).find("div:eq(1)").text().trim();

    switch(type){
      case 'File':
      
      extension = name.substr(name.lastIndexOf('.') + 1);
      
      const fileAttribute = await getFileAttribute(ar.eq(index).find("a").attr("href"));
      

      const matches = rec.filter(item => item['extension'] === extension);

      if(matches.length==0){
      
        dictionary[extension] = rec.length;
        rec.push({
          extension:extension,
          count:1,
          lines:fileAttribute.lines,
          bytes:fileAttribute.bytes
        });
        
      }else{
        rec[dictionary[extension]].count++;
        rec[dictionary[extension]].lines+=fileAttribute.lines;
        rec[dictionary[extension]].bytes+=fileAttribute.bytes;
      }

      break;
    
    case 'Directory':
      await getFolder("https://github.com"+ar.eq(index).find("a").attr("href"));
      break;
  
    }


  }

}




/*
const server = http.createServer(function (req, res) {
  var url = "https://github.com/axios/axios";
  
  (async function() {


    console.log("Start");
    
    await getFolder(url);

    console.log("Result:");
    console.log(rec);
    console.log("End");

   

  })();
  

})
*/


async function start(url){

    // console.log("Start");
    
    await getFolder(url);

    return rec;

    console.log("Result:");
    console.log(rec);
    console.log("End");
  
}


app.get('/', (req, res) => {
  res.send('Welcome!')
});

// GET 
app.get('/get', async function (req, res) {
  
  const result = await start(req.query.url);

  res.json(result);
  // rec = null;
  // res.send(result) ;
});

// POST
app.post('/get', function (req, res) {
  res.send('POST request to the homepage');
});


app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`)
});