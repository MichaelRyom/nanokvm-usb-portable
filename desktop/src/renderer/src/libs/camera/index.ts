class Camera {
  id: string = ''
  width: number = 1920
  height: number = 1080
  stream: MediaStream | null = null

  public async open(id?: string, width?: number, height?: number): Promise<boolean> {
    if (!id && !this.id) {
      return false
    }

    try {
      this.close()

      const constraints = {
        video: {
          deviceId: { exact: id || this.id },
          width: { ideal: width || this.width },
          height: { ideal: height || this.height }
        }
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (id) this.id = id
      if (width) this.width = width
      if (height) this.height = height

      return true
    } catch (err) {
      console.log(err)
      return false
    }
  }

  public close(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
  }

  public getStream(): MediaStream | null {
    return this.stream
  }

  public isOpen(): boolean {
    return this.stream !== null
  }
}

export const camera = new Camera()