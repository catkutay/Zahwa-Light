import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { Capacitor} from '@capacitor/core';
import { Filesystem,Directory, } from '@capacitor/filesystem';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalController, Platform } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PhotoService } from '../services/photo.service';
import { DragsterComponent } from '../modals/dragster/dragster.component';
import { SessionsService } from '../services/sessions.service';
import { ToolsService } from '../services/tools.service';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver'

@Component({
  selector: 'app-tab2',
  templateUrl: './tab2.page.html',
  styleUrls: ['./tab2.page.scss'],
})
export class Tab2Page implements OnInit {
  @ViewChild('filePicker', { static: false }) filePickerRef: ElementRef<HTMLInputElement>;
  photo: SafeResourceUrl;
  isDesktop: boolean;
  webPath?: string;
  display: any
  
  
  constructor(
    private platform: Platform,
    private sanitizer: DomSanitizer, 
    private photoService: PhotoService,
    private sessions: SessionsService,
    private modalCtrl: ModalController,
    private tools: ToolsService,
    private http: HttpClient
    ) { }

    async ngOnInit() {
      
      this.display = await this.photoService.loadSaved();
    }
    dataURLtoFile(dataurl, filename, format) {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8ClampedArray(n);
      while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
      }
      saveAs(new File([u8arr], "11.png", {type: format}));
  }




    async addPhotoToGallery() {
      this.photoService.addNewToGallery();
    
    }
  async getPicture(type: string ) {
    if (!Capacitor.isPluginAvailable('Camera') || (this.isDesktop && type === 'gallery')) {
      console.log(type)
      this.filePickerRef.nativeElement.click();
      return;
    }

    const image = await Camera.getPhoto({
      quality: 100,
      width: 400,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt
    });
this.dataURLtoFile(image.dataUrl,"image111",image.format)
/*
      const options = {
        resultType: CameraResultType.Uri
      };
      Camera.getPhoto(options).then(
        photo => {
          Filesystem.readFile({
            path: photo.path
          }).then(
            result => {
              let date = new Date(),
                time = date.getTime(),
                fileName = time + ".jpeg";
              Filesystem.writeFile({
                data: result.data,
                path: fileName,
                directory: Directory.Data
              }).then(
                () => {
                  Filesystem.getUri({
                    directory: Directory.Data,
                    path: fileName
                  }).then(
                    result => {
                      let path = Capacitor.convertFileSrc(result.uri);
                      console.log(path);
                    },
                    err => {
                      console.log(err);
                    }
                  );
                },
                err => {
                  console.log(err);
                }
              );
            },
            err => {
              console.log(err);
            }
          );
        },
        err => {
          console.log(err);
        }
      );
*/  

  }
/*
  onFileChoose(event: Event) {
    const file = (event.target as HTMLInputElement).files[0];
    const pattern = /image-*/;
/*    const reader = new FileReader();

    if (!file.type.match(pattern)) {
      console.log('File format not supported');
      return;
    }

    reader.onload = () => {
      this.photo = reader.result.toString();
    };
    reader.readAsDataURL(file);

  }
*/
/*
private async savePicture(cameraPhoto:[]) {
  // Convert photo to base64 format, required by Filesystem API to save
  const base64Data = await this.readAsBase64(cameraPhoto);

  // Write the file to the data directory
  const fileName = new Date().getTime() + '.jpeg';
  const savedFile = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Data
  });

  // Use webPath to display the new image instead of base64 since it's
  // already loaded into memory
  return {
    filepath: fileName,
    webviewPath: cameraPhoto.Path
  };

  private async readAsBase64(cameraPhoto: []) {
    // Fetch the photo, read as a blob, then convert to base64 format
    const response = await fetch(cameraPhoto.Path!);
    const blob = await response.blob();
  
    return await this.convertBlobToBase64(blob) as string;
  }
  
  convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
        resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}*/
}