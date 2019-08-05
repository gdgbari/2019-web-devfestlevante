import getJSON from 'get-json';
import moment from 'moment';

class Hoverboard {

    constructor(sessions, speakers, schedules) {
        this.sessions = sessions;
        this.speakers = speakers;
        this.schedules = schedules;
    }

    getSchedules() { return Hoverboard.convert2JSON(this.schedules); }
    getSessions() { return Hoverboard.convert2JSON(this.sessions); }
    getSpeakers() { return Hoverboard.convert2JSON(this.speakers); }

    static convert2JSON(object) { return JSON.parse(JSON.stringify(object)); }

    static async load(sessionizeID) {

      // Set local language for date conversion
      moment.locale('it');

      // Get JSONs from sessionize
      const schedulesJSON = await getJSON('https://sessionize.com/api/v2/' + sessionizeID + '/view/GridSmart');
      const speakersJSON = await getJSON('https://sessionize.com/api/v2/' + sessionizeID + '/view/speakers');

      // Load sessions
      const sessionsData = this.loadSessions(schedulesJSON); // Schedules gives us needed informations to build the session
      const sessions = sessionsData[0];
      const sessionsMapping = sessionsData[1];

      // Load speakers
      const speakers = this.loadSpeakers(speakersJSON);

      // Load schedules
      const schedules = this.loadSchedules(schedulesJSON, sessionsMapping);

      return new Hoverboard(
        sessions,
        speakers,
        schedules
      );
    }

    static loadSchedules(schedulesJSON, sessionsMapping) {

        const schedules = schedulesJSON.map(schedule => Schedule.fromJSON(schedule, sessionsMapping));

        let finalSchedules = {};
        schedules.forEach(schedule => finalSchedules[schedule.date] = schedule);

        return finalSchedules;
    }

    static loadSessions(schedulesJSON) {

        let sessions = {};
        let sessionsMapping = {};
        const sessionStartOffset = 100;

        schedulesJSON.forEach(schedule => {
            schedule.timeSlots.forEach(timeslot => {
                timeslot.rooms.forEach(room => {

                    // TODO improve: extend with more session per room in one single timeslot

                    const currSession = room.session;

                    let newSession = undefined;
                    if(currSession.isServiceSession) {
                        newSession = new SessionDetailsService(
                            currSession.title,
                            currSession.description ? currSession.description : "",
                        );
                    } else {

                        // Get language
                        const langObj = currSession.categories.find(x => x.name === "Language");
                        let language = undefined;
                        if(langObj && langObj.categoryItems[0]) {
                            language = langObj.categoryItems[0].name;
                        }

                        // Get level
                        const complexityObj = currSession.categories.find(x => x.name === "Level");
                        let complexity = undefined;
                        if(complexityObj && complexityObj.categoryItems[0]) {
                            complexity = complexityObj.categoryItems[0].name;
                        }

                        newSession = new SessionDetailsTalk(
                            currSession.title,
                            currSession.description ? currSession.description : "",
                            currSession.speakers.map(speaker => speaker.name.toLowerCase().replace(" ", "_")),
                            undefined, // TODO
                            currSession.extend ? currSession.extend : undefined,
                            currSession.videoId ? currSession.videoId : undefined, // TODO improve: implement this feature
                            currSession.presentation ? currSession.presentation : undefined, // TODO improve: implement this feature
                            language,
                            complexity,
                        );
                    }

                    sessionsMapping[currSession.id] = sessionStartOffset + Object.keys(sessionsMapping).length;
                    sessions[sessionsMapping[currSession.id]] = newSession;
                })
            })
        });

        return [sessions, sessionsMapping];
    }

    static loadSpeakers(speakersJSON) {

        let speakers = {};

        speakersJSON.forEach((speaker, index) => {
            speakers[speaker.firstName.toLowerCase() + '_' + speaker.lastName.toLowerCase()] = new Speaker(
                speaker.fullName,
                speaker.bio ? speaker.bio : "",
                speaker.bio ? speaker.bio.substr(0, 64) + '...' : "",
                speaker.tagLine,
                speaker.profilePicture,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                index
            );
        });

        return speakers;

    }
}

class Schedule {

    constructor(date, dateReadable, timeslots, tracks) {
        this.date = date;
        this.dateReadable = dateReadable;
        this.timeslots = timeslots;
        this.tracks = tracks;
    }

    static fromJSON(json, sessionsMapping) {
        return new Schedule(
            moment(json.date).format('YYYY-MM-DD'),
            moment(json.date).format('D MMMM'),
            this.loadTimeslots(json.timeSlots, sessionsMapping),
            this.loadTracks(json.rooms)
        );
    }

    static loadTimeslots(timeslotsJSON, sessionsMapping) {
        return timeslotsJSON.map(timeslot => new Timeslot(
            timeslot.slotStart.substring(0, 5),
            this.calcMaxSlotTime(timeslot.rooms),
            this.loadSessions(timeslot.rooms, sessionsMapping),
        ));
    }

    static calcMaxSlotTime(rooms) {

        if(rooms.length === 0 || !rooms[0].session) {
            return "-";
        }

        let max = new Date(rooms[0].session.endsAt);

        rooms.forEach(room => {
            const current = new Date(room.session.endsAt);
            if(current.getTime() > max.getTime()) {
                max = current;
            }
        });

        return moment(max).format('HH:mm');
    }

    static loadTracks(rooms) {
        return rooms.map(room => new Track(room.name));
    }

    static loadSessions(rooms, sessionsMapping) {
        return rooms.map(room => new Session(
            [sessionsMapping[room.session.id]] // TODO improve: to add more IDs (more events in one single room and one single timeslice)
        ));
    }

}

class Timeslot {
    constructor(startTime, endTime, sessions){
        this.startTime = startTime;
        this.endTime = endTime;
        this.sessions = sessions;
    }
}

class Track {
    constructor(title) {
        this.title = title;
    }
}

class Session {
    constructor(sessionIDs) {
        this.items = sessionIDs;
    }
}

class SessionDetailsBase {
    constructor(title, description, language = undefined, complexity = undefined) {
        this.title = title;
        this.description = description;
        language !== undefined ? this.language = language: null;
        complexity !== undefined ? this.complexity = complexity: null;
    }
}

class SessionDetailsService extends SessionDetailsBase {
    constructor(title, description, icon, image, language = undefined, complexity = undefined) {
        super(title, description, language, complexity);
        icon ? this.icon = icon : this.icon = "";
        image ? this.image = image : this.image = "";
    }
}

class SessionDetailsTalk extends SessionDetailsBase {
    constructor(title, description, speakers, tags, extend = undefined, videoId = undefined, presentation = undefined, language = undefined, complexity = undefined) {
        super(title, description, language, complexity);
        this.speakers = speakers;
        tags !== undefined ? this.tags = tags : this.tags = ["DevFest"]; // TODO check a problem with tags
        extend !== undefined ? this.extend = extend : null;
        videoId !== undefined ? this.videoId = videoId : null;
        presentation !== undefined ? this.presentation = presentation : null;
        language !== undefined ? this.language = language : null;
        complexity !== undefined ? this.complexity = complexity : null;
    }
}

class Speaker {
    constructor(name, bio, shortBio, title, photoUrl, company = undefined, companyLogo = undefined, companyLogoUrl = undefined, country = undefined, featured = undefined, photo = undefined, socials = undefined, order = 0) {
        this.name = name;
        this.bio = bio ? bio : "";
        this.shortBio = shortBio ? shortBio : "";
        this.title = title ? title : "";
        this.photoUrl = photoUrl ? photoUrl : "";
        //this.company ? this.company = company : null;
        this.company = title; // Use this as text to render as company
        this.companyLogo ? this.companyLogo = companyLogo : null;
        this.companyLogoUrl ? this.companyLogoUrl = companyLogoUrl : null;
        this.country ? this.country = country : null;
        this.featured ? this.featured = featured : null;
        this.photo ? this.photo = photo : null;
        this.socials ? this.socials = socials : null;
        this.sessions = []; // TODO improve: implement this
        this.order = order
    }
}

class Social {
    constructor(icon, link, name) {
        this.icon = icon;
        this.link = link;
        this.name = name;
    }
}

module.exports = { Hoverboard };
