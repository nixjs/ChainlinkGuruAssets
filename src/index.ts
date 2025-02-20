import * as fs from 'fs'
import * as path from 'path'
import { imageSize } from 'image-size'
import * as dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

interface Response {
    status: 'success' | 'failure'
}

interface MetadataImage {
    src: string
    title?: string
    width: number
    height: number
    type?: string
}

export async function commitFile(path: string, content: string): Promise<Response> {
    const token = process.env.GITHUB_ACCESS_TOKEN
    const owner = process.env.GITHUB_OWNER ?? '#'
    const repo = process.env.GITHUB_REPO ?? '#'
    const githubAPI = 'https://api.github.com/repos'
    const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
    }
    const fileContents = await axios.request({
        method: 'get',
        maxBodyLength: Infinity,
        url: `${githubAPI}/${owner}/${repo}/contents`,
        headers,
    })

    const fileTarget = (fileContents.data as any[]).find((c) => c.name === path)
    if (!fileTarget) return { status: 'failure' }
    const data = JSON.stringify({
        message: 'server generation',
        committer: { name: 'nixjs', email: 'nghiweb@gmail.com' },
        content,
        sha: fileTarget.sha,
    })

    const result = await axios.request({
        method: 'put',
        maxBodyLength: Infinity,
        url: `${githubAPI}/${owner}/${repo}/contents/${path}`,
        headers,
        data: data,
    })
    if (result.data) return { status: 'success' }
    return { status: 'failure' }
}

async function main() {
    const ACCEPTED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']

    const rootPath = process.cwd()
    const assetPath = path.join(rootPath, 'assets/memes')

    let list: MetadataImage[] = []
    const files = await fs.readdirSync(assetPath)
    for (const entry of files) {
        const entryPath = path.join(assetPath, entry)
        const fileSplit = entry.split('.')
        const fileExtension = fileSplit.pop()?.toLowerCase()

        if (ACCEPTED_EXT.includes(fileExtension ?? '')) {
            try {
                const { height, width, type } = await imageSize(entryPath)
                list.push({
                    type,
                    height: height ?? 400,
                    width: width ?? 800,
                    src: `${process.env.GITHUB_URL}/${entry}`,
                    title: fileSplit?.[0] ?? entry,
                })
            } catch (error) {
                console.error(`Error processing ${entry}:`, error)
            }
        }
    }
    const content = Buffer.from(JSON.stringify(list)).toString('base64')
    console.log('Chainlink.guru => Generating')
    return await commitFile('list.json', content)
}
main().then(() => console.log('Chainlink.guru => DONE'))
