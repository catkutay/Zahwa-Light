import * as functions from 'firebase-functions'
//import vision from '@google-cloud/vision'
import * as admin from 'firebase-admin'
const vision = require('@google-cloud/vision')

admin.initializeApp()

exports.processImage = functions.storage.object().onFinalize(async (object) => {
    if (object.contentType && !object.contentType.startsWith('image/')) {
        return null
      }
      // Check the image content using the Cloud Vision API.
    const visionClient = new vision.ImageAnnotatorClient()
    const objectData = await visionClient.objectLocalization(
        `gs://${object.bucket}/${object.name}`
    )
    const fname = object.name.substring(object.name.lastIndexOf('/')+1)
    const imageStoreRef = admin.firestore().doc('/images/' + fname)
    const imageMeta = {
        meta: object.metadata,
        objects: objectData
    }
    await imageStoreRef.set(imageMeta)
})
