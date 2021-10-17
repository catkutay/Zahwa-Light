import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DataService } from './data.service';
import { ISession, IAudioResource, ILocalImage } from '../interface';
import { SafeStyle, DomSanitizer } from '@angular/platform-browser';

@Injectable({
    providedIn: 'root'
})
export class SessionsService {
    constructor(private data: DataService, private detol: DomSanitizer) { }
    observeSessions(): Observable<ISession[]> {
        return this.data.observeSessions()
    }
    async createSession(images: { date: Date, name: string, width: number, height: number, blob: Blob | File }[], coverIndex: number = 0) {
        const fileIds: string[] = []
        for (const image of images) {
            const fileId = await this.data.saveFile(image.blob, 'image', {
                originalName: image.name,
                originalDate: image.date,
                width: image.width,
                height: image.height
             })
            fileIds.push(fileId)
        }
        const session: ISession = {
            date: new Date(),
            user: this.data.userString,
            synced: 0,
            coverId: fileIds[coverIndex],
            stage: 1,
            location: this.data.position,
            imageIds: fileIds
        }
        await this.data.database.sessions.put(session)
        this.data.sync()
    }

    // deprecated
    async getImageStyleFromId(id: string): Promise<{style: SafeStyle, width: number, height: number}> {
        const f = await this.data.getFile(id)
        if (!f) {
            throw new Error('data: getImageStyleFromId() called for non-existent id ' + id)
        }
        const oUrl = URL.createObjectURL(f.file)
        return {
            style: this.detol.bypassSecurityTrustStyle('url(' + oUrl + ')'),
            width: f.extra ? f.extra.width : null,
            height: f.extra ? f.extra.height : null
        }
    }

    async getLocalImageFromId(id: string): Promise<ILocalImage> {
        const f = await this.data.getFile(id)
        if (!f) {
            throw new Error('data: getLocalImageFromId() called for non-existent id ' + id)
        }
        const oUrl = URL.createObjectURL(f.file)
        return {
            src: this.detol.bypassSecurityTrustResourceUrl(oUrl),
            style: this.detol.bypassSecurityTrustStyle('url(' + oUrl + ')'),
            width: f.extra ? f.extra.width : null,
            height: f.extra ? f.extra.height : null
        }
    }

    async updateSessionPrimaryAudio(
        id: string,
        updated: any,
        audio: { blob: Blob, language: string, frames: number, channels: number, sampleRate: number }) {
        const oldsession = await this.data.database.sessions.get(id)
        const sourceId = await this.data.saveFile(audio.blob, 'audio', {
            frames: audio.frames,
            sampleRate: audio.sampleRate,
            channels: audio.channels
        })
        const aResource: IAudioResource = {
            fileId: sourceId,
            languageId: audio.language,
            frames: audio.frames,
            channels: audio.channels,
            sampleRate: audio.sampleRate,
            type: 'source'
        }
        updated.primary = aResource
        updated.synced = false
        if (oldsession.primary) {
            await this.data.deleteFile(oldsession.primary.fileId)
        }
        await this.data.database.sessions.update(id, updated)
    }

    async deleteSessions(sessionIds: string[]) {
        for (const id of sessionIds) {
            const sesh = await this.data.database.sessions.get(id)
            for (const imageId of sesh.imageIds) {
                this.data.deleteFile(imageId)
            }
            if (sesh.primary) {
                this.data.deleteFile(sesh.primary.fileId)
            }
            if (sesh.secondary) {
                for (const sec of sesh.secondary) {
                    this.data.deleteFile(sec.fileId)
                }
            }
            if (sesh.imageLabelAudio) {
                this.data.deleteFile(sesh.imageLabelAudio.fileId)
            }
            this.data.database.sessions.delete(id)
        }
    }

}
