import Replicate from 'replicate'
import dotenv from 'dotenv'
dotenv.config()

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  userAgent: 'https://www.npmjs.com/package/create-replicate'
})
const model = 'openai/gpt-image-2:875d2396848b8447d556115adaa81d4d0508d03a0b61c9d51da0d069efd00c35'
const input = {
  prompt: 'A photo of a computer screen displaying a Spotify playlist in golden hour evening in a living room with lots of green plants in the background. The playlist says GPT-image-2. caption is "this new image model from OpenAI is dope." and the artists are Replicate. the songs are themes about open source AI and Machine learning. the account name is Replicate. use the logo for replicate as the profile picture and artist image.',
  quality: 'auto',
  background: 'auto',
  moderation: 'auto',
  aspect_ratio: '3:2',
  input_images: [
    'https://replicate.delivery/pbxt/Oy2U6Sw4k3ZYEZ5cXeuVJMq8k45GQ17J2iKvt1HcHVUtVj5O/download.jpg',
  ],
  output_format: 'webp',
  number_of_images: 1,
  output_compression: 90,
}

console.log('Using model: %s', model)
console.log('With input: %O', input)

console.log('Running...')
const output = await replicate.run(model, { input })
console.log('Done!', output)
