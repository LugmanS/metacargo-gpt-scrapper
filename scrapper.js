import axios from "axios"
import fs from "fs"
import chapterData from "./chapterData.json" assert { type: "json" }
import pLimit from "p-limit"

// if (fs.existsSync("./results")) {
//   fs.rmSync("./results", { recursive: true, force: true })
// }

// if (fs.existsSync("./raw-results")) {
//   fs.rmSync("./raw-results", { recursive: true, force: true })
// }

if (!fs.existsSync("./results")) {
  fs.mkdirSync("./results")
  fs.mkdirSync("./raw-results")
}

const completeList = []
Object.values(chapterData).forEach((chapter) => {
  fs.mkdirSync(`./results/${chapter.chapter_no}`)
  chapter.headings.forEach((heading) => {
    fs.mkdirSync(`./results/${chapter.chapter_no}/${heading.heading_no}`)
    heading.subheadings.forEach((subheading) => {
      completeList.push({
        hscode: subheading.heading_no,
        paths: [chapter.chapter_no, heading.heading_no],
      })
    })
  })
})

// const chunks = chunkArray(completeList, 600)
// console.log("Workers count:", chunks.length)

// chunks.forEach((chunk, workerIndex) => {
//   for (const index in chunk) {
//     const path = `./results/${chunk[index].paths[0]}/${chunk[index].paths[1]}/${chunk[index].hscode}.json`
//     generateData(chunk[index].hscode, path, chunk[index])
//   }
// })

async function main() {
  try {
    const limit = pLimit(6)
    const requests = []
    completeList.forEach((subheading) => {
      if (
        fs.existsSync(
          `./results/${subheading.paths[0]}/${subheading.paths[1]}/${subheading.hscode}.json`
        )
      ) {
        console.log("Generated already for hscode:", subheading.hscode)
        return
      }
      requests.push(
        limit(() => {
          const path = `./results/${subheading.paths[0]}/${subheading.paths[1]}/${subheading.hscode}.json`
          return generateData(subheading.hscode, path, subheading)
        })
      )
    })
    const results = await Promise.all(requests)
    console.log("Completed")
  } catch (error) {
    console.log("main error: ", error)
  }
}

const erroredItems = []

async function generateData(hsno, path, headingObj) {
  try {
    const sendTime = new Date()
    console.log("Send time: ", sendTime)
    const response = await axios({
      method: "post",
      maxBodyLength: Infinity,
      url: "https://intogloopenaigpt4.openai.azure.com/openai/deployments/GPT4-preview/chat/completions?api-version=2023-07-01-preview",
      headers: {
        "Content-Type": "application/json",
        "api-key": "eca6ccaae30c4d338ade1f5942427a99",
      },
      data: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              'You are an HS code export, For any given hs code brief description about it in 300 words, and generate as many real-world products as you can. Give maximum real-world products as you can. Only respond in JSON format {"hscode": <Hs code>, "heading" : <Heading for the Code>, "description": <Brief description about the hs code in 300 words", "products" : [list of all the products in the this form {"name": name of the product,"description": brief description about the product,"applications": applications of the product in real world}], "keyAttributes": [ list of object  where the object is of { attribute: <Key attribute of the code>, description: <Description about the attribute>}], "searchTags": [ list of search tags by which the heading and its products can be searched]}. Generate as minimum of 30 products. Make sure the json is fully generated and is of json syntax',
          },
          {
            role: "user",
            content: hsno,
          },
        ],
        temperature: 0.8,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
        max_tokens: 4000,
        stop: null,
        response_format: {
          type: "json_object",
        },
      }),
    })
    const receivedTime = new Date()
    const data = response.data
    fs.writeFileSync(
      `./raw-results/${hsno}.json`,
      JSON.stringify(response.data)
    )
    const parsedData = JSON.stringify(
      JSON.parse(data.choices[0].message.content.replace())
    )
    fs.writeFileSync(path, parsedData)
    console.log("Success for hscod:", hsno)
  } catch (error) {
    console.log(error)
    erroredItems.push({
      ...headingObj,
      error,
    })
    fs.writeFileSync("./errored-items.json", JSON.stringify(erroredItems))
  }
}

main()
