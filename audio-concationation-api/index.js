import AWS from 'aws-sdk';
import axios from 'axios';
import { PassThrough } from 'stream';

// Ensure AWS SDK is configured
if (!AWS.config.region) {
    AWS.config.update({ region: 'ap-southeast-1' }); // Ensure this matches your S3 bucket's region
}

const s3 = new AWS.S3();

export const handler = async (event) => {
    try {
        const { files, user_id, host } = event;

        // Assuming files is an array of URLs to audio files
        const audioStreams = await Promise.all(files.map(async (fileUrl) => {
            const response = await axios.get(fileUrl, { responseType: 'stream' });
            return response.data;
        }));

        // Concatenate audio streams
        const concatStream = new PassThrough();
        audioStreams.forEach((stream, index) => {
            if (index > 0) {
                concatStream.write('\n'); // This might not be suitable for audio files
            }
            stream.pipe(concatStream, { end: false });
        });
        concatStream.end();

        // Upload concatenated stream to S3
        const params = {
            Bucket: 'storynestai',
            Key: `${user_id}/concatenated_audio.mp3`, // Adjust the key as needed
            Body: concatStream,
            ContentType: 'audio/mpeg'
        };

        const uploadResult = await s3.upload(params).promise();
        const fileUrl = uploadResult.Location; // URL of the uploaded file

        return {
            statusCode: 200,
            body: JSON.stringify({ fileUrl }),
        };
    } catch (error) {
        console.error('Error:', error);
        // Log the error object directly to CloudWatch Logs for more detailed information
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
