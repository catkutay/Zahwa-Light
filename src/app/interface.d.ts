//import { GpsPoint } from 'haversine-position';
import { Gesture } from '@ionic/core'
import { SafeStyle, SafeUrl } from '@angular/platform-browser'

export { IDatabase } from 'src/app/services/indexeddb'

export interface IGDriveUser {
    zahwaDir: string
}

export interface IAudioFile {
    sampleRate: number
    frames: number
    channels: number
    file: Blob | File
}

export interface IAudioResource {
    fileId: string
    languageId: string
    sampleRate: number
    channels: number
    frames: number
    type: string
    source?: {
        filename: string
        lastModifiedDate: Date
    }
    map?: {
        sourceId: string
        map: IMapSegment[]
        finished: boolean
    }
}

// segments may now have no secondary span
export interface IMapSegment {
    source: {
        startMs: number
        endMs: number
    }
    secondary?: {
        startMs: number
        endMs: number
        frames: number
        offset: number
    }
}

interface ISyncable {
    synced: number
    gdrivedir?: string
}

export enum IWorkStage {
    IMPORTED = 1,
    RECORDED = 2,
    DESCRIBED = 3,
    COMPLETED = 4,
}

export interface IImageLabel {
    id?: string
    gcv?: {
        name: string,
        m: string,
        verts: {x: number, y: number}[]
    }
    audio?: {startFrame: number, endFrame: number},
    box?: {x1: number, y1: number, x2: number, y2: number},
    orth?: {iso: string, text: string}[]
}

export interface ISession extends ISyncable {
    id?: string
    date: Date
    user: string
    coverId?: string
    stage: IWorkStage
    tags?: string[]
    location?: { lat: number, lng: number }
    imageIds: string[]
    imageLabels?: {[key: string]: IImageLabel[]}
    imageLabelAudio?: IAudioResource
    primary?: IAudioResource
    igvTimeline?: IGVSegment[] 
    secondary?: IAudioResource[]
}

export interface IFile extends ISyncable {
    id?: string
    date: Date
    user: string
    file: Blob
    extra?: any
}

export interface IGVSegment {
    promptId: string
    startMs: number,
    endMs?: number
    gestures?: Gesture[]
}

export interface IGlottoLanguage {
    iso?: string
    glottocode: string
    name: string
    pos?: [number, number]
}

export interface IUserDocument {
    displayName: string
    email: string
    photoURL: string
    storeURL: string
}

export interface ILocalImage {
    src: SafeUrl
    style: SafeStyle
    width: number
    height: number
}
