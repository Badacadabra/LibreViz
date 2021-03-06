var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');
var jsonfile = require('jsonfile');
var ejs = require('ejs');

var app = express();
/**
 * Recherche des catégories
 * */
var findCategories = function(db, callback) {
  var collection = db.collection('rows_items');
  collection.distinct("categorie",function(err, result) {
    callback(result);
  });
}
/**
 * Recherche des sous-catégories
 * */
var findSubCategories = function(category,db,callback) {
  var collection = db.collection('rows_items');
   collection.find({categorie:category},{fonctionnalite:1}).toArray(function(err, result) {
    callback(result);
  });
}
/**
 * Recherche les logiciels d'une sous-catégorie donnée
 * */
var findSoftwaresBySubCategory = function(subCategory,db,callback) {
  var collection = db.collection('rows_items');
   collection.find({fonctionnalite:subCategory},{logiciels_libres_linux:1}).toArray(function(err, result) {
    callback(result);
  });
}
/**
 * Recherche les informations d'un logiciel donné
 * */
var findSoftwareInfos = function(software,db,callback) {
  var collection = db.collection('software_items');
   collection.find({nom:software}).toArray(function(err, result) {
    callback(result);
  });
}
/**
 * Recherche les logiciels correspondant au critère de recherche
 * */
var findSoftwares = function(param,db,callback) {
  var collection = db.collection('software_items');
   collection.find({nom: new RegExp(param,'i')}).toArray(function(err, result) {
    callback(result);
  });
}

var url = 'mongodb://localhost:27017/floss';
var items;
var links;
var subCategories = [];
var res = false;
/**
 * Fonction permettant de reformater
 * le json provenant de la base
 * */
function parser(result,fileName,type,param)
{
    items = [];
    links = [];
    for(var i=0, j=1; i < result.length; i++, j++) {
        if (type=="category") { //Formatage des catégories
            items[i] = {"name":result[i]};
            links[i] = {"source":0,"target":j};
        }
        else if (type=="subCategory") { //Formatage des sous-catégories
            items[i] = {"name":result[i].fonctionnalite};
            links[i] = {"source":0,"target":j};
        } else { //Formatage des logiciels
            var sfw_tab = result[i].logiciels_libres_linux;
            for (var k=0, l=1;  k < sfw_tab.length; k++,l++) {
                items[k] = {"name":sfw_tab[k]};
                links[k] = {"source":0,"target":l};
            }
        }
    }
    if (type=="category") {
        items.unshift({"name":"Catégorie"});
    } else if(type=="subCategory") {
        items.unshift({"name":param});
    } else if(type="software"){
        items.unshift({"name":param});
    }

    var data = {'nodes':items,'links':links};

    /**
     * Création du fichier json
     * */
    jsonfile.writeFile(fileName, data, {spaces: 2}, function (err) {
        //console.log("file created successfully");
    });
}
/**
 * Permet de charger les données depuis MOngoDB
 * @param param : paramètre reçu de l'url
 * **/

function loadDataMongo(type, param)
{
    MongoClient.connect(url, function(err, db) {
        console.log("Connected correctly to server");
        if(type=="category") {
            findCategories(db, function(result) {
                parser(result,'ui/data/category.json',"category");
                db.close();
            });
        } else if(type=="subCategory") {
            findSubCategories (param, db, function(result) {
                parser(result,'ui/data/subCategory.json',"subCategory",param);
                db.close();
            });
        } else if(type=="software"){
            findSoftwaresBySubCategory(param, db, function(result) {
                parser(result,'ui/data/software.json',"software",param);
                db.close();
            });
        }
    });
}
/**
 * Spécification du chemin des fichiers static
 * */
app.use(express.static(__dirname + '/ui'))
app.use(express.static(__dirname + '/node_modules'))
app.use(express.static(__dirname + '/bower_components'))
/**
 * Route d'affichage des catégories
 * */
.get('/', function(req, res) {
    loadDataMongo("category");
    res.render('index.ejs', {script:"loadGraph.js"});
})
/**
 * Route d'affichage des sous-catégories d'une catégorie donnée
 * */
.get('/categorie/:category', function(req, res) {
    var p  = req.params.category,
        tab_s = p.split("_"),
    param = tab_s.length > 0 ? p.replace(/_/g," ") : p;
    //var text_404 = '<h2 style="text-align:center;margin-top:40px;margin:auro;" class="well well-lg">Oups ! il semble que la donnée que vous cherchez n\'existe pas.</h2>';
    //loadDataMongo("subStep", param) ? res.render('index.ejs', {}) : res.status(404).send(text_404);
    loadDataMongo("subCategory", param);
    res.render('index.ejs', {script:"loadGraph.js"});

})
/**
 * Route d'affichage des logiciels d'une sous-catégorie donnée
 * */
.get('/sous-categorie/:subcategory', function(req, res) {
    var p  = req.params.subcategory,
        tab_s = p.split("_"),
        param = tab_s.length > 0 ? p.replace(/_/g," ") : p;

    loadDataMongo("software", param);
    res.render('index.ejs', {script:"loadGraph.js"});
})
/**
 * Route d'affichage des informations d'un logiciel donné
 * */
.get('/logiciel/:software', function(req, res) {
    var p  = req.params.software,
        tab_s = p.split("_"),
        param = tab_s.length > 0 ? p.replace(/_/g," ") : p;

    MongoClient.connect(url, function(err, db) {
        findSoftwareInfos(param, db, function(result) {
            db.close();
            res.set('Content-Type','application/json');
            res.send({result:result});
        });
    });
})
/**
 * Renvoie la liste des logiciels correspondant au critère de recherche
 * */
.get('/search/:term', function(req, res) {
    MongoClient.connect(url, function(err, db) {
        findSoftwares(req.params.term, db, function(result) {
            db.close();
            res.set('Content-Type','application/json');
            res.send({result:result});
        });
    });
})
/**
 * Affichage de la page À propos
 * */
.get('/a-propos', function(req, res) {
    res.render('index.ejs', {isAboutPage:true,script:null});
})
/**
 * Affichage de la page Histogramme
 * */
.get('/histogramme', function(req, res) {
    res.render('index.ejs', {script:"loadBarChart.js"});
})
/**
 * Affichage de la page Camembert
 * */
.get('/camembert', function(req, res) {
    res.render('index.ejs', {script:"loadPieChart.js"});
})
/**
 * Lancement du serveur sur le port 8080
 * */
app.listen(8080);
