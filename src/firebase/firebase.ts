import {FirebaseConfig} from "../config";
import {credential, initializeApp, database} from "firebase-admin";


initializeApp({
    credential: credential.cert(FirebaseConfig.getCredentials()),
    databaseURL: "https://jarvis-4f754-default-rtdb.firebaseio.com"
});

const DB = database();
const PREFIX = 'jarvis';


export class Firebase {
    static async getObject(path: string): Promise<{}> {
        return (await DB.ref(PREFIX + '/' + path).once('value')).val();
    }

    static async getArray(path: string): Promise<Array<{}>> {
        return (await DB.ref(PREFIX + '/' + path).once('value')).val() || [];
    }

    static async setValue(path: string, value: {}) {
        await DB.ref(PREFIX + '/' + path).set(value);
    }

    static async remove(path: string) {
        await DB.ref(PREFIX + '/' + path).remove();
    }
}
