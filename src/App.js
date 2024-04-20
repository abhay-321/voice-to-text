import React, { useState, useEffect } from 'react';
import AWS from 'aws-sdk';
import TranscribeService from 'aws-sdk/clients/transcribeservice'; // Import only the S3 client
import './App.css';


function App() {
  AWS.config.update({
    accessKeyId: "", // add aws access key here
    secretAccessKey: "", // add aws access key here
    region: 'us-west-1'
  });
  const transcribeService = new TranscribeService();
  const s3 = new AWS.S3(); // Create a new S3 client instance
  const [textValue, setTextValue] = useState('');
  const handleTextChange = (event) => {
    setTextValue(event.target.value);
  };
  const [isLoading, setIsLoading] = useState(false);

  async function connectAndTranscribe() {
    console.time('Time taken');
    const transcribeService = new AWS.TranscribeService();
    const jobName = generateRandomNumber().toString();
    console.log({ jobName });
    const params = {
      TranscriptionJobName: jobName,
      Media: {
        // Assuming your file is stored locally in the project directory:
        MediaFileUri: 's3://bucket-name/filename.mp3', // Replace with the actual path to your audio file
      },
      OutputBucketName: 's3://bucket-name/',
      OutputKey: jobName + ".json",
      MediaFormat: 'mp3', // Adjust based on your audio file format (e.g., 'wav')
      LanguageCode: 'en-US', // Specify your desired language code
    };

    try {
      setIsLoading(true);
      const response = await transcribeService.startTranscriptionJob(params).promise();
      console.log("0 response", response);
      const jobId = response.TranscriptionJob.TranscriptionJobName;
      console.log("1 jobId", jobId);

      // Wait for the transcription job to complete (asynchronous)
      await waitForTranscriptionJobCompletion(jobId);

      // Get the transcribed text (implementation details in next step)
      const transcribedText = await getTranscriptionResult(jobId);

      console.log('4 Transcription Result:', transcribedText);
      setTextValue(transcribedText);
      setIsLoading(false);
      console.timeEnd('Time taken');

    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function waitForTranscriptionJobCompletion(jobId) {
    let jobStatus = 'IN_PROGRESS';
    while (jobStatus === 'IN_PROGRESS') {
      const getTranscriptionJobResponse = await transcribeService.getTranscriptionJob({ TranscriptionJobName: jobId }).promise();
      // console.log("2 getTranscriptionJobResponse", getTranscriptionJobResponse);
      jobStatus = getTranscriptionJobResponse.TranscriptionJob.TranscriptionJobStatus;
      // console.log("3 getTranscriptionJobResponse", getTranscriptionJobResponse);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before checking again
    }
  }

  async function getTranscriptionResult(jobId) {
    const transcribeService = new AWS.TranscribeService();

    try {
      const params = {
        TranscriptionJobName: jobId,
      };

      const getTranscriptionJobResponse = await transcribeService.getTranscriptionJob(params).promise();

      // Check the transcription job status
      const jobStatus = getTranscriptionJobResponse.TranscriptionJob.TranscriptionJobStatus;
      if (jobStatus === 'COMPLETED') {

        // Fetch the transcribed text file content from S3 (assuming accessible)
        const transcriptS3URI = getTranscriptionJobResponse.TranscriptionJob.Transcript.TranscriptFileUri;
        console.log("transcriptS3URI", transcriptS3URI);
        const bucketKey = jobId + ".json";
        const s3Params = { Bucket: 'voice-to-text-thinkitive', Key: bucketKey };
        const s3Response = await s3.getObject(s3Params).promise();

        // Convert the S3 object data to string (assuming plain text format)
        const transcribedText = s3Response.Body.toString();
        const transcribedTextJson = JSON.parse(transcribedText);
        return transcribedTextJson.results.transcripts[0].transcript;
        // const transcript = getTranscriptionJobResponse.TranscriptionJob.Transcript.TranscriptFileUri;
        // return transcript; // Return the transcript URI for further processing or download
      } else {
        console.error(`Transcription job with ID ${jobId} is still in progress (Status: ${jobStatus})`);
        return null; // Indicate that the transcript is not yet available
      }
    } catch (error) {
      console.error('Error getting transcription result:', error);
      throw error; // Re-throw the error for further handling
    }
  }

  const generateRandomNumber = () => {
    const min = 100000; // Minimum 6-digit number (inclusive)
    const max = 999999; // Maximum 6-digit number (inclusive)
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  return (
    <div className="App">
      {!isLoading ? (
        <button className="custom-button" style={{ marginTop: '2rem' }} onClick={connectAndTranscribe}> Click to Start Transcribing... </button>
      ) : (
        <button className="custom-button flicker-text" style={{ marginTop: '2rem' }} onClick={connectAndTranscribe}> Processing... </button>
      )}
      <div>
        <div>
          <textarea
            style={{ marginTop: '2rem' }}
            value={textValue}
            onChange={handleTextChange}
            rows={7} // Specify the number of rows for the textarea
            cols={50} // Specify the number of columns for the textarea
          />
        </div>
      </div>
    </div>
  );
}

export default App;
