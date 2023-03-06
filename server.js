require('dotenv').config()

const express = require('express')
const path = require('path')
const assert = require('assert')
const { Pool } = require('pg')

const PORT = process.env.PORT || 5163

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

const query = async function (sql, params) {
  assert.strictEqual(typeof sql, 'string',
    'Expected src to be a string')

  let client
  let results = []
  try {
    client = await pool.connect()
    const response = await client.query(sql, params)
    if (response && response.rows) {
      results = response.rows
    }
  } catch (err) {
    console.error(err)
  }
  if (client) client.release()
  return results
}

const healthQuery = async function () {
  const result = await query('SELECT * FROM Recipe LIMIT 1;', [])

  let status = 200
  let msg = 'healthy'

  if (result === undefined || result.length === 0) {
    status = 500
    msg = 'unhealthy'
  }

  return { status, msg }
}

const getRecipesQuery = async function () {
  const result = await query('SELECT * FROM Recipe;', [])

  let status = 200
  let msg = 'healthy'

  if (result === undefined || result.length === 0) {
    status = 500
    msg = 'unhealthy'
  }

  return { status, msg, result }
}

module.exports = {
  query,
  healthQuery,
  getRecipesQuery
}

express()
  .use(express.static(path.join(__dirname, 'public/')))
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', function (req, res) {
    res.render('pages/index')
  })
  .get('/health', async function (req, res) {
    const result = await healthQuery()
    res.status(result.status).send(result.msg)
  })
  .get('/about', function (req, res) {
    res.render('pages/about')
  })
  .get('/contact', function (req, res) {
    res.render('pages/contact')
  })
  .get('/finder', async function (req, res) {
    const results = await getRecipesQuery()
    res.render('pages/finder', { recipes: results.result })
  })
  .get('/addRecipe', function (req, res) {
    res.render('pages/addRecipe')
  })
  .get('/getRecipes', async function (req, res) {
    const results = await getRecipesQuery()
    res.status(200).json({ recipes: results.result })
  })
  .post('/newRecipe', async function (req, res) {
    const { name, calsPerServing, costPerServing, ingredients, steps } = req.body
    console.log(name)
    console.log(calsPerServing)
    if (name === null || name === '' || ingredients === null || ingredients === '' || steps === null || steps === '') {
      res.status(400).send('Bad Request')
      res.end()
    } else {
      const sql = 'INSERT INTO Recipe (name, calsPerServing, costPerServing) VALUES ($1, $2, $3);'
      const params = [name, calsPerServing, costPerServing]
      const recipeResult = await query(sql, params)
      const sql2 = 'INSERT INTO Ingredient (ingredient_name) VALUES ($1);'
      for (let i = 0; i < ingredients.length; i++) {
        const params2 = [ingredients[i]]
        const ingredientResult = await query(sql2, params2)
      }
      const sql3 = 'INSERT INTO StepList (recipe_id, step_number, step_text) VALUES ($1, $2, $3);'
      for (let i = 0; i < steps.length; i++) {
        const params3 = [recipeResult[0].id, i + 1, steps[i]]
        const stepResult = await query(sql3, params3)
      }
      const sql4 = 'INSERT INTO IngredientList (recipe_id, ingredient_id, amount) VALUES ($1, $2, $3);'
      for (let i = 0; i < ingredients.length; i++) {
        const params4 = [recipeResult[0].id, i + 1, ingredients[i]]
        const ingredientListResult = await query(sql4, params4)
      }
      res.status(200).json({ recipeResult })
    }
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`))
