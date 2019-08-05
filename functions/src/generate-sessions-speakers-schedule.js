import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import mapSessionsSpeakersSchedule from './schedule-generator/speakers-sessions-schedule-map';

import { Hoverboard } from './sessionizeCore';

export const updateFromSessionize = functions.https.onRequest((req, res) => {

  const sessionizeID = 'r0c6xdh8';

  Hoverboard.load(sessionizeID).then(async hoverboard => {

    // Remove previous generated data
    await deleteCollection("generatedSchedule");
    await deleteCollection("generatedSessions");
    await deleteCollection("generatedSpeakers");

    // Generate new data from sessionize and save to Firestore
    await generateAndSaveData(hoverboard.getSessions(), hoverboard.getSchedules(), hoverboard.getSpeakers());

    res.send("Firestore updated from Sessionize API using ID " + sessionizeID);

  });

});

async function generateAndSaveData(sessions, schedule, speakers) {

  let generatedData = mapSessionsSpeakersSchedule(sessions, speakers, schedule);

  saveGeneratedData(generatedData.sessions, 'generatedSessions');
  saveGeneratedData(generatedData.speakers, 'generatedSpeakers');
  saveGeneratedData(generatedData.schedule, 'generatedSchedule');
}

function saveGeneratedData(data, collectionName) {
  if (!data || !Object.keys(data).length) return;

  for (let index = 0; index < Object.keys(data).length; index++) {
    const key = Object.keys(data)[index];
    firestore().collection(collectionName)
      .doc(key)
      .set(data[key]);
  }
}

async function deleteCollection(path) {

  // Get a new write batch
  const batch = firestore().batch();

  const docs = await firestore().collection(path).listDocuments();

  docs.map((val) => {
    batch.delete(val);
  });

  await batch.commit();

}
