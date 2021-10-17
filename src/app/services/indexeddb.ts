import Dexie from 'dexie'
import 'dexie-observable'
import { ISession, IFile, IGDriveUser } from 'src/app/interface'

export class IDatabase extends Dexie {
  sessions: Dexie.Table<ISession, string>
  files: Dexie.Table<IFile, string>
  gdriveusers: Dexie.Table<IGDriveUser, string>
  constructor (databaseName) {
    super(databaseName)
    this.version(1).stores({
      files: '$$id, date, user, synced',
      sessions: '$$id, date, user, synced',
      gdriveusers: ''
    })
    this.sessions = this.table('sessions')
    this.files = this.table('files')
    this.gdriveusers = this.table('gdriveusers')
  }
}
