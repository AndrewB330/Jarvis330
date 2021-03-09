import * as nodeHtmlToImage from "node-html-to-image";
import {readFileSync} from "fs";

const TEMPLATES_FOLDER = 'templates\\';
const IMAGES_FOLDER = 'images\\';

export class Charts {
    static async generateDistributionChart(data: number[], labels: string[]): Promise<string> {
        let html = readFileSync(TEMPLATES_FOLDER + 'distribution.html').toString();
        html = html.replace('_DATA_', JSON.stringify(data));
        html = html.replace('_LABELS_', JSON.stringify(labels));
        try {
            // @ts-ignore
            await nodeHtmlToImage({
                output: IMAGES_FOLDER + 'distribution.png',
                html
            });
        } catch (e) {
            console.error(e);
            return '';
        }
        return IMAGES_FOLDER + 'distribution.png';
    }
}
