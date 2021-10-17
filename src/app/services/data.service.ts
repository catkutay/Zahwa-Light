import { Injectable } from '@angular/core'
import { IDatabase } from './indexeddb';
import { BehaviorSubject, Observable } from 'rxjs'
import { ICreateChange, IUpdateChange, IDeleteChange } from 'dexie-observable/api'
import { Haversine, GpsPoint } from 'haversine-position'
import { DomSanitizer } from '@angular/platform-browser';
import { IFile, ISession, IAudioResource, IAudioFile } from '../interface';
import glotto from './glotto.json'
import { AuthenticateService } from './authentication';
import * as firebase from 'firebase/app'

@Injectable({
    providedIn: 'root'
})
export class DataService {
    database: IDatabase = new IDatabase('zahwa2')
    userString: string = 'local'
    sessionsMap: Map<string, ISession> = new Map()
    sessionSubject: BehaviorSubject<ISession[]> = new BehaviorSubject([])
    isodata = []
    position: GpsPoint = null
    posWatcher: number
    usedMaps: { langs: Map<string, string[]>, tags: Map<string, string[]> } = { langs: new Map(), tags: new Map() }
    isSynching: boolean = false
    firestore: firebase.firestore.Firestore = firebase.firestore()
    constructor(
        private detol: DomSanitizer,
        private auth: AuthenticateService
    ) {
        this.database.open()
        this._positionSetup()
        this._setup()
    }

    _positionSetup() {
        // triggers on having obtained a new location
        const setNearbyLanguages = () => {
            this._addLanguageToUsedMap('stan1293') // always add english
            Object.keys(glotto).forEach((key) => {
                if (glotto[key].pos) {
                    const dist = this.getDistance({ lat: glotto[key].pos[0], lng: glotto[key].pos[1] })
                    if (dist < 100000) {
                        this._addLanguageToUsedMap(key)
                    }
                }
            })
        }
        const posLat = localStorage.getItem('cachedLattitude')
        const posLng = localStorage.getItem('cachedLongitude')
        if (posLat) {
            this.position = {
                lat: parseFloat(posLat),
                lng: parseFloat(posLng)
            }
            setNearbyLanguages()
        }
        if ("geolocation" in navigator) {
            this.posWatcher = navigator.geolocation.watchPosition((position) => {
                this.position = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
                localStorage.setItem('cachedLattitude', position.coords.latitude.toString())
                localStorage.setItem('cachedLongitude', position.coords.longitude.toString())
                setNearbyLanguages() // fire when we have an actual position from the browser
            })
        } else {
            console.warn('no geolocation')
        }
    }

    async _setup() {
        const sessions = await this.database.sessions.toArray()
        this.sessionSubject.next(sessions)
        // make a map since it's nicer to find, set, delete
        for (const session of sessions) {
            this.sessionsMap.set(session.id, session)
        }
        // this._extractUsedProperties()
        // use Dexie observable to watch for db changes
        this.database.on('changes', async (changes) => {
            console.log('changed fired', changes)
            let sessionChange: boolean = false
            const updated: string[] = []
            changes.forEach(async (change) => {
                if (change.table === 'sessions') {
                    sessionChange = true
                    switch (change.type) {
                        case 1: // CREATED
                            this.sessionsMap.set((change as ICreateChange).key, change['obj'])
                            break
                        case 2: // UPDATED
                            updated.push((change as IUpdateChange).key)
                            break
                        case 3: // DELETED
                            this.sessionsMap.delete((change as IDeleteChange).key)
                            break
                    }
                }
            })
            // this is a workaround for dexie observable bug that leaves empty fields in change objects.
            // for (let update of updated) {
            //    this.sessionsMap.set(update, await this.getSession(update))
            // }
            if (sessionChange) {
                this.sessionSubject.next(Array.from(this.sessionsMap.values()))
                //this._extractUsedProperties()
            }
        })
    }

    // UsedMaps.langs can have empty array entries. This means 'show the language, but it doesn't refer
    // to any session we have made'. This is non destructive, it only ever adds.
    _addLanguageToUsedMap(code: string, id: string = null) {
        if (code !== 'unknown') {
            if (this.usedMaps.langs.has(code) && id) {
                // it's in the map and we have an id, so push it
                this.usedMaps.langs.get(code).push(id)
            } else if (!this.usedMaps.langs.has(code)) {
                // it's not in the map, so either add it with an id or an empty array if we have no id
                this.usedMaps.langs.set(code, id ? [id] : [])
            }
        }
    }

    getDistance(gp: GpsPoint): number {
        return Haversine.getDistance(gp, this.position)
    }

    // Observe an array of sessions
    observeSessions(): Observable<ISession[]> {
        return this.sessionSubject.asObservable()
    }

    //
    // File storage
    //
    // Extra field is typically used for audio to include frames and sampleRate.
    // This data is duplicated in IAudioResource in ISession
    async saveFile(f: File | Blob, ftype: string, extra?: any): Promise<string> {
        const putData = {
            date: new Date(),
            user: this.userString,
            type: ftype,
            synced: 0,
            file: f,
            extra: extra
        }
        const idval = await this.database.files.put(putData)
        return idval
    }
    getFile(id: string): Promise<IFile> {
        return this.database.files.get(id)
    }
    async getAudioFile(ares: IAudioResource): Promise<IAudioFile> {
        const ifile: IFile = await this.getFile(ares.fileId)
        return {
            file: ifile.file,
            frames: ares.frames,
            channels: ares.channels,
            sampleRate: ares.sampleRate
        }
    }
    deleteFile(id: string): Promise<any> {
        return this.database.files.delete(id)
    }
    //
    // Structured data - Sessions
    //

    //
    // Sync
    //
    async sync() {
        if (!this.auth.isAuthenticated() || this.isSynching) return;
        this.isSynching = true
        const uid = this.auth.getUser().uid
        const unsynced = this.database.files.where({synced: 0})
        const ids: string[] = []
        const res = await unsynced.each((f) => {
            ids.push(f.id)
        })
        try {
            for (const id of ids) {
                const item = await this.database.files.get(id)
                const ref = firebase.storage().ref(uid + '/' + id)
                console.log('uploading')
                await ref.put(item.file)
                console.log('done')
                await this.database.files.update(id, {synced: 1})
            }
        } finally {
            this.isSynching = false
        }
    }

    async getGoogleLabels(filenames: string[]): Promise<Map<string, any[]>> {
        const m = new Map()
        let exists = false
        for (const f of filenames) {
            const colRef = firebase.firestore().collection('images').doc(f)
            const data = await colRef.get()
            if (data.exists) {
                exists = true
                m.set(f, data.data().objects[0].localizedObjectAnnotations)
            }
        }
        return exists ? m : null
    }

}