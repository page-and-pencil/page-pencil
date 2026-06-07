const BOOK_DB=[];
const DOLCH_WORDS={"a":"pk","and":"pk","away":"pk","big":"pk","blue":"pk","can":"pk","come":"pk","down":"pk","find":"pk","for":"pk","funny":"pk","go":"pk","help":"pk","here":"pk","i":"pk","in":"pk","is":"pk","it":"pk","jump":"pk","little":"pk","look":"pk","make":"pk","me":"pk","my":"pk","not":"pk","one":"pk","play":"pk","red":"pk","run":"pk","said":"pk","see":"pk","the":"pk","three":"pk","to":"pk","two":"pk","up":"pk","we":"pk","where":"pk","who":"pk","you":"pk","all":"k","am":"k","are":"k","at":"k","ate":"k","be":"k","black":"k","brown":"k","but":"k","came":"k","did":"k","do":"k","eat":"k","four":"k","get":"k","good":"k","have":"k","he":"k","into":"k","like":"k","must":"k","new":"k","no":"k","now":"k","on":"k","our":"k","out":"k","please":"k","pretty":"k","ran":"k","ride":"k","saw":"k","say":"k","she":"k","so":"k","soon":"k","that":"k","there":"k","they":"k","this":"k","too":"k","under":"k","want":"k","was":"k","well":"k","went":"k","what":"k","white":"k","will":"k","with":"k","yes":"k","after":"g1","again":"g1","an":"g1","any":"g1","ask":"g1","as":"g1","by":"g1","could":"g1","every":"g1","fly":"g1","from":"g1","give":"g1","giving":"g1","had":"g1","has":"g1","her":"g1","him":"g1","his":"g1","how":"g1","just":"g1","know":"g1","let":"g1","live":"g1","may":"g1","of":"g1","old":"g1","once":"g1","open":"g1","over":"g1","put":"g1","round":"g1","some":"g1","stop":"g1","take":"g1","thank":"g1","them":"g1","think":"g1","walk":"g1","were":"g1","when":"g1","always":"g2","around":"g2","because":"g2","been":"g2","before":"g2","best":"g2","both":"g2","buy":"g2","call":"g2","cold":"g2","does":"g2","fast":"g2","first":"g2","five":"g2","found":"g2","gave":"g2","goes":"g2","green":"g2","its":"g2","made":"g2","many":"g2","off":"g2","or":"g2","pull":"g2","read":"g2","right":"g2","sing":"g2","sit":"g2","sleep":"g2","tell":"g2","their":"g2","these":"g2","those":"g2","upon":"g2","us":"g2","use":"g2","very":"g2","wash":"g2","which":"g2","why":"g2","wish":"g2","work":"g2","would":"g2","write":"g2","your":"g2","about":"g3","better":"g3","bring":"g3","carry":"g3","clean":"g3","cut":"g3","done":"g3","draw":"g3","drink":"g3","eight":"g3","fall":"g3","far":"g3","full":"g3","got":"g3","grow":"g3","hold":"g3","hot":"g3","hurt":"g3","if":"g3","keep":"g3","kind":"g3","laugh":"g3","light":"g3","long":"g3","much":"g3","myself":"g3","never":"g3","only":"g3","own":"g3","pick":"g3","seven":"g3","shall":"g3","show":"g3","six":"g3","small":"g3","start":"g3","ten":"g3","today":"g3","together":"g3","try":"g3","warm":"g3"};
const FRY_WORDS={"the":1,"or":2,"will":3,"number":4,"of":5,"one":6,"up":7,"no":8,"and":9,"had":10,"other":11,"way":12,"a":13,"by":14,"about":15,"could":16,"to":17,"words":18,"out":19,"people":20,"in":21,"but":22,"many":23,"my":24,"is":25,"not":26,"then":27,"than":28,"you":29,"what":30,"them":31,"that":32,"all":33,"these":34,"water":35,"it":36,"were":37,"so":38,"been":39,"he":40,"we":41,"some":42,"called":43,"was":44,"when":45,"her":46,"who":47,"for":48,"your":49,"would":50,"oil":51,"on":52,"can":53,"make":54,"sit":55,"are":56,"said":57,"like":58,"now":59,"as":60,"there":61,"him":62,"find":63,"with":64,"use":65,"into":66,"long":67,"his":68,"an":69,"time":70,"down":71,"they":72,"each":73,"has":74,"day":75,"i":76,"which":77,"look":78,"did":79,"at":80,"she":81,"two":82,"get":83,"be":84,"do":85,"more":86,"come":87,"this":88,"how":89,"write":90,"made":91,"have":92,"their":93,"go":94,"may":95,"from":96,"if":97,"see":98,"part":99,"over":100,"say":101,"set":102,"try":103,"new":104,"great":105,"put":106,"kind":107,"sound":108,"where":109,"end":110,"hand":111,"take":112,"help":113,"does":114,"picture":115,"only":116,"through":117,"another":118,"again":119,"little":120,"much":121,"well":122,"change":123,"work":124,"before":125,"large":126,"off":127,"know":128,"line":129,"must":130,"play":131,"place":132,"right":133,"big":134,"spell":135,"years":136,"too":137,"even":138,"air":139,"live":140,"means":141,"such":142,"away":143,"me":144,"old":145,"because":146,"animal":147,"back":148,"any":149,"turn":150,"house":151,"give":152,"same":153,"here":154,"point":155,"most":156,"tell":157,"why":158,"page":159,"very":160,"boy":161,"ask":162,"letter":163,"after":164,"follow":165,"went":166,"mother":167,"things":168,"came":169,"men":170,"answer":171,"our":172,"want":173,"read":174,"found":175,"just":176,"show":177,"need":178,"study":179,"name":180,"also":181,"land":182,"still":183,"good":184,"around":185,"different":186,"learn":187,"sentence":188,"form":189,"home":190,"should":191,"man":192,"three":193,"us":194,"america":195,"think":196,"small":197,"move":198,"world":199,"high":200,"saw":201,"important":202,"miss":203,"every":204,"left":205,"until":206,"idea":207,"near":208,"children":209,"enough":210,"add":211,"few":212,"side":213,"eat":214,"food":215,"while":216,"feet":217,"face":218,"between":219,"along":220,"car":221,"watch":222,"own":223,"might":224,"mile":225,"far":226,"below":227,"close":228,"night":229,"indian":230,"country":231,"something":232,"walk":233,"real":234,"plant":235,"seem":236,"white":237,"almost":238,"last":239,"next":240,"sea":241,"let":242,"school":243,"hard":244,"began":245,"above":246,"father":247,"open":248,"grow":249,"girl":250,"keep":251,"example":252,"took":253,"sometimes":254,"tree":255,"begin":256,"river":257,"mountains":258,"never":259,"life":260,"four":261,"cut":262,"start":263,"always":264,"carry":265,"young":266,"city":267,"those":268,"state":269,"talk":270,"earth":271,"both":272,"once":273,"soon":274,"eyes":275,"paper":276,"book":277,"light":278,"together":279,"hear":280,"song":281,"thought":282,"got":283,"stop":284,"being":285,"head":286,"group":287,"without":288,"leave":289,"under":290,"often":291,"family":292,"story":293,"run":294,"late":295,"body":296,"order":297,"farm":298,"music":299,"red":300,"wind":301,"pulled":302,"color":303,"door":304,"rock":305,"draw":306,"stand":307,"sure":308,"space":309,"voice":310,"sun":311,"become":312,"covered":313,"seen":314,"questions":315,"top":316,"fast":317,"cold":318,"fish":319,"ship":320,"several":321,"cried":322,"area":323,"across":324,"hold":325,"plan":326,"mark":327,"today":328,"himself":329,"notice":330,"dog":331,"during":332,"toward":333,"south":334,"horse":335,"short":336,"five":337,"sing":338,"birds":339,"better":340,"step":341,"war":342,"problem":343,"best":344,"morning":345,"ground":346,"complete":347,"however":348,"passed":349,"fall":350,"room":351,"low":352,"vowel":353,"king":354,"knew":355,"hours":356,"true":357,"town":358,"since":359,"black":360,"hundred":361,"ever":362,"products":363,"against":364,"unit":365,"piece":366,"happened":367,"pattern":368,"figure":369,"told":370,"whole":371,"numeral":372,"certain":373,"usually":374,"measure":375,"table":376,"field":377,"remember":378,"north":379,"travel":380,"friends":381,"early":382,"slowly":383,"wood":384,"easy":385,"waves":386,"money":387,"fire":388,"heard":389,"reached":390,"map":391,"upon":392,"done":393,"decided":394,"plane":395,"filled":396,"english":397,"contain":398,"system":399,"heat":400,"road":401,"course":402,"behind":403,"full":404,"half":405,"surface":406,"ran":407,"hot":408,"ten":409,"produce":410,"round":411,"check":412,"fly":413,"building":414,"boat":415,"object":416,"gave":417,"ocean":418,"game":419,"am":420,"box":421,"class":422,"force":423,"rule":424,"finally":425,"note":426,"brought":427,"among":428,"wait":429,"nothing":430,"understand":431,"noun":432,"correct":433,"rest":434,"warm":435,"power":436,"oh":437,"carefully":438,"common":439,"cannot":440,"quickly":441,"scientists":442,"bring":443,"able":444,"person":445,"inside":446,"explain":447,"six":448,"became":449,"wheels":450,"dry":451,"size":452,"shown":453,"stay":454,"though":455,"dark":456,"minutes":457,"green":458,"language":459,"ball":460,"strong":461,"known":462,"shape":463,"material":464,"verb":465,"island":466,"deep":467,"special":468,"stars":469,"week":470,"thousands":471,"heavy":472,"front":473,"less":474,"yes":475,"fine":476,"feel":477,"machine":478,"clear":479,"pair":480,"fact":481,"base":482,"equation":483,"circle":484,"inches":485,"ago":486,"yet":487,"include":488,"street":489,"stood":490,"government":491,"built":492,"picked":493,"legs":494,"beside":495,"matter":496,"simple":497,"sat":498,"gone":499,"square":500,"cells":501,"main":502,"sky":503,"syllables":504,"paint":505,"winter":506,"grass":507,"perhaps":508,"mind":509,"wide":510,"million":511,"bill":512,"love":513,"written":514,"west":515,"felt":516,"cause":517,"length":518,"lay":519,"suddenly":520,"rain":521,"reason":522,"weather":523,"test":524,"exercise":525,"kept":526,"root":527,"direction":528,"eggs":529,"interest":530,"instruments":531,"center":532,"train":533,"arms":534,"meet":535,"farmers":536,"blue":537,"brother":538,"ready":539,"wish":540,"race":541,"months":542,"anything":543,"drop":544,"present":545,"paragraph":546,"divided":547,"developed":548,"beautiful":549,"raised":550,"general":551,"window":552,"store":553,"represent":554,"energy":555,"difference":556,"job":557,"soft":558,"subject":559,"distance":560,"edge":561,"whether":562,"europe":563,"heart":564,"past":565,"clothes":566,"moon":567,"site":568,"sign":569,"flowers":570,"region":571,"sum":572,"record":573,"shall":574,"return":575,"summer":576,"finished":577,"teacher":578,"believe":579,"wall":580,"discovered":581,"held":582,"dance":583,"forest":584,"wild":585,"describe":586,"members":587,"probably":588,"happy":589,"drive":590,"cross":591,"already":592,"hair":593,"rolled":594,"speak":595,"instead":596,"age":597,"bear":598,"solve":599,"phrase":600,"amount":601,"wonder":602,"appear":603,"soil":604,"scale":605,"smiled":606,"metal":607,"bed":608,"pounds":609,"angle":610,"son":611,"copy":612,"although":613,"fraction":614,"either":615,"free":616,"per":617,"africa":618,"ice":619,"hope":620,"broken":621,"killed":622,"sleep":623,"spring":624,"moment":625,"melody":626,"village":627,"case":628,"tiny":629,"bottom":630,"factors":631,"laughed":632,"possible":633,"trip":634,"result":635,"nation":636,"gold":637,"hole":638,"jumped":639,"quite":640,"milk":641,"poor":642,"snow":643,"type":644,"quiet":645,"ride":646,"themselves":647,"natural":648,"fight":649,"care":650,"temperature":651,"lot":652,"surprise":653,"floor":654,"bright":655,"stone":656,"french":657,"hill":658,"lead":659,"act":660,"died":661,"pushed":662,"everyone":663,"build":664,"beat":665,"baby":666,"method":667,"middle":668,"exactly":669,"buy":670,"section":671,"speed":672,"remain":673,"century":674,"lake":675,"count":676,"dress":677,"outside":678,"iron":679,"consonant":680,"cat":681,"everything":682,"within":683,"someone":684,"tall":685,"dictionary":686,"sail":687,"fingers":688,"row":689,"president":690,"yourself":691,"caught":692,"least":693,"brown":694,"control":695,"fell":696,"catch":697,"trouble":698,"practice":699,"team":700,"climbed":701,"cool":702,"report":703,"god":704,"wrote":705,"cloud":706,"straight":707,"captain":708,"shouted":709,"lost":710,"rise":711,"direct":712,"continued":713,"sent":714,"statement":715,"ring":716,"itself":717,"symbols":718,"stick":719,"serve":720,"else":721,"wear":722,"party":723,"child":724,"plains":725,"bad":726,"seeds":727,"desert":728,"gas":729,"save":730,"suppose":731,"increase":732,"england":733,"experiment":734,"woman":735,"history":736,"burning":737,"engine":738,"coast":739,"cost":740,"design":741,"alone":742,"bank":743,"maybe":744,"joined":745,"drawing":746,"period":747,"business":748,"foot":749,"east":750,"wire":751,"separate":752,"law":753,"choose":754,"pay":755,"break":756,"ears":757,"single":758,"clean":759,"uncle":760,"glass":761,"touch":762,"visit":763,"hunting":764,"information":765,"bit":766,"flow":767,"grew":768,"express":769,"whose":770,"lady":771,"skin":772,"mouth":773,"received":774,"students":775,"valley":776,"yard":777,"garden":778,"human":779,"cents":780,"equal":781,"please":782,"art":783,"key":784,"decimal":785,"strange":786,"feeling":787,"supply":788,"guess":789,"thick":790,"major":791,"corner":792,"silent":793,"blood":794,"observe":795,"electric":796,"trade":797,"lie":798,"tube":799,"insects":800,"rather":801,"spot":802,"necessary":803,"crops":804,"compare":805,"bell":806,"weight":807,"tone":808,"crowd":809,"fun":810,"meat":811,"hit":812,"poem":813,"loud":814,"lifted":815,"sand":816,"enjoy":817,"consider":818,"process":819,"doctor":820,"elements":821,"suggested":822,"army":823,"provide":824,"indicate":825,"thin":826,"hat":827,"thus":828,"except":829,"position":830,"property":831,"expect":832,"entered":833,"particular":834,"cook":835,"flat":836,"fruit":837,"swim":838,"bones":839,"seven":840,"tied":841,"terms":842,"mall":843,"interesting":844,"rich":845,"current":846,"board":847,"sense":848,"dollars":849,"park":850,"modern":851,"string":852,"send":853,"sell":854,"compound":855,"blow":856,"sight":857,"shoulder":858,"mine":859,"famous":860,"chief":861,"industry":862,"value":863,"japanese":864,"wash":865,"fit":866,"wings":867,"stream":868,"block":869,"addition":870,"movement":871,"planets":872,"spread":873,"belong":874,"pole":875,"rhythm":876,"cattle":877,"safe":878,"exciting":879,"eight":880,"wife":881,"soldiers":882,"branches":883,"science":884,"sharp":885,"company":886,"sister":887,"gun":888,"total":889,"radio":890,"oxygen":891,"similar":892,"deal":893,"plural":894,"death":895,"determine":896,"action":897,"various":898,"score":899,"evening":900,"capital":901,"agreed":902,"forward":903,"hoe":904,"factories":905,"opposite":906,"stretched":907,"rope":908,"settled":909,"wrong":910,"experience":911,"cotton":912,"yellow":913,"chart":914,"rose":915,"apple":916,"prepared":917,"allow":918,"details":919,"southern":920,"pretty":921,"fear":922,"entire":923,"truck":924,"solution":925,"workers":926,"corn":927,"fair":928,"fresh":929,"washington":930,"substances":931,"printed":932,"shop":933,"greek":934,"smell":935,"suffix":936,"women":937,"tools":938,"ahead":939,"especially":940,"bought":941,"conditions":942,"chance":943,"shoes":944,"led":945,"cows":946,"born":947,"actually":948,"march":949,"track":950,"level":951,"nose":952,"northern":953,"arrived":954,"triangle":955,"afraid":956,"create":957,"located":958,"molecules":959,"dead":960,"british":961,"sir":962,"france":963,"sugar":964,"difficult":965,"seat":966,"repeated":967,"adjective":968,"match":969,"division":970,"column":971,"fig":972,"win":973,"effect":974,"western":975,"office":976,"underline":977,"church":978,"huge":979,"steel":980,"view":981};
const OXFORD_CEFR={"abandon":"B2","absolute":"B2","academic":"B1","acceptable":"B2","accompany":"B2","account":"B1","accurate":"B2","accuse":"B2","acknowledge":"B2","acquire":"B2","actual":"B2","adapt":"B2","additional":"B2","address":"A1","administration":"B2","adopt":"B2","advance":"B2","affair":"B2","afterwards":"B2","agency":"B2","agenda":"B2","aggressive":"B2","aid":"B2","aircraft":"B2","alarm":"B1","alter":"B2","amount":"A2","anger":"B2","angle":"B2","anniversary":"B2","annual":"B2","anxious":"B2","apparent":"B2","apparently":"B2","appeal":"B2","approach":"B2","appropriate":"B2","approval":"B2","approve":"B2","arise":"B2","armed":"B2","arms":"B2","artificial":"B2","artistic":"B2","ashamed":"B2","aspect":"B2","assess":"B2","assessment":"B2","associate":"B2","associated":"B2","association":"B2","assume":"B2","attempt":"B2","back":"A1","bacteria":"B2","bar":"A2","barrier":"B2","basically":"B2","battle":"B1","bear":"A2","beat":"A2","beg":"B2","being":"B2","bent":"B2","bet":"B2","beyond":"B2","bill":"A1","bitter":"B2","blame":"B2","blind":"B2","bond":"B2","border":"B1","breast":"B2","brief":"B2","broad":"B2","broadcast":"B2","budget":"B2","bullet":"B2","bunch":"B2","burn":"A2","bush":"B2","but":"A1","cable":"B2","calculate":"B2","cancel":"B2","cancer":"B2","capable":"B2","capacity":"B2","capture":"B2","cast":"B2","catch":"A2","cell":"B2","chain":"B1","chair":"A1","chairman":"B2","challenge":"B1","characteristic":"B2","chart":"A1","chief":"B2","circumstance":"B2","cite":"B2","citizen":"B2","civil":"B2","classic":"B2","close":"A1","closely":"B2","collapse":"B2","combination":"B2","comfort":"B2","command":"B2","commission":"B2","commitment":"B2","committee":"B2","commonly":"B2","complex":"B1","complicated":"B2","component":"B2","concentration":"B2","concept":"B2","concern":"B2","concerned":"B2","conduct":"B2","confidence":"B2","conflict":"B2","confusing":"B2","conscious":"B2","conservative":"B2","consideration":"B2","consistent":"B2","constant":"B2","constantly":"B2","construct":"B2","construction":"B2","contemporary":"B2","contest":"B2","contract":"B2","contribute":"B2","contribution":"B2","convert":"B2","convinced":"B2","core":"B2","corporate":"B2","council":"B2","county":"B2","courage":"B2","crash":"B2","creation":"B2","creature":"B2","credit":"A2","crew":"B2","crisis":"B2","criterion":"B2","critic":"B2","critical":"B2","criticism":"B2","criticize":"B2","crop":"B2","crucial":"B2","cry":"A2","cure":"B2","current":"B1","curve":"B2","curved":"B2","date":"A1","debate":"B2","debt":"B2","decent":"B2","declare":"B2","decline":"B2","decoration":"B2","decrease":"B2","deeply":"B2","defeat":"B2","defence":"B2","defend":"B2","delay":"B2","deliberate":"B2","deliberately":"B2","delight":"B2","delighted":"B2","delivery":"B2","demand":"B2","demonstrate":"B2","deny":"B2","depressed":"B2","depressing":"B2","depth":"B2","desert":"A2","deserve":"B2","desire":"B2","desperate":"B2","detail":"A1","detailed":"B2","detect":"B2","dig":"B2","disc":"B2","discipline":"B2","discount":"B1","dishonest":"B2","dismiss":"B2","display":"B2","distribute":"B2","distribution":"B2","district":"B2","divide":"B1","division":"B2","document":"A2","domestic":"B2","dominate":"B2","downwards":"B2","dozen":"B2","draft":"B2","drag":"B2","dramatic":"B2","edit":"B2","edition":"B2","efficient":"B2","elderly":"B2","elect":"B2","elsewhere":"B2","emerge":"B2","emotional":"B2","emphasis":"B2","emphasize":"B2","enable":"B2","encounter":"B2","engage":"B2","enhance":"B2","enquiry":"B2","ensure":"B2","enthusiasm":"B2","enthusiastic":"B2","entire":"B2","entirely":"B2","equal":"B1","establish":"B2","estate":"B2","estimate":"B2","ethical":"B2","evaluate":"B2","even":"A1","evil":"B2","examination":"B2","excuse":"B2","executive":"B2","existence":"B2","expectation":"B2","expense":"B2","exploration":"B2","expose":"B2","extend":"B2","extent":"B2","external":"B2","extraordinary":"B2","extreme":"A2","facility":"B2","failure":"B2","faith":"B2","fault":"B2","favour":"B1","feather":"B2","fee":"B2","feed":"A2","feedback":"B2","feel":"A1","fellow":"B2","figure":"A2","file":"B1","finance":"B2","finding":"B2","firm":"B2","fix":"A2","flame":"B2","flash":"B2","flexible":"B2","float":"B2","fold":"B1","folding":"B2","following":"A2","forgive":"B2","former":"B2","fortune":"B2","forward":"A2","found":"B2","free":"A1","freedom":"B2","frequency":"B2","fuel":"B1","fully":"B2","function":"B1","fund":"B2","fundamental":"B2","funding":"B2","furthermore":"B2","gain":"B2","gang":"B2","generate":"B2","genre":"B2","govern":"B2","grab":"B2","grade":"B1","gradually":"B2","grand":"B2","grant":"B2","guarantee":"B2","handle":"B2","harm":"B2","harmful":"B2","hearing":"B2","heaven":"B2","heel":"B2","hell":"B2","hesitate":"B2","high":"A1","hire":"B1","hold":"A2","hollow":"B2","holy":"B2","honour":"B2","host":"B1","house":"A1","household":"B2","housing":"B2","humorous":"B2","humour":"B2","hunt":"B1","hunting":"B2","hurt":"A2","ideal":"A2","illustrate":"B2","illustration":"B2","imagination":"B2","impatient":"B2","imply":"B2","impose":"B2","impress":"B2","impressed":"B2","inch":"B2","incident":"B2","income":"B2","increasingly":"B2","industrial":"B2","infection":"B2","inform":"B2","initial":"B2","initially":"B2","initiative":"B2","inner":"B2","insight":"B2","insist":"B2","inspire":"B2","install":"B2","instance":"B2","institute":"B2","institution":"B2","insurance":"B2","intended":"B2","intense":"B2","internal":"B2","interpret":"B2","interrupt":"B2","investigation":"B2","investment":"B2","issue":"B1","joy":"B2","judgement":"B2","junior":"B2","justice":"B2","justify":"B2","labour":"B2","landscape":"B2","largely":"B2","latest":"B1","launch":"B2","leadership":"B2","league":"B2","lean":"B2","leave":"A1","level":"A2","licence":"B2","limited":"B2","line":"A1","lively":"B2","load":"B2","loan":"B2","logical":"B2","long-term":"B2","loose":"B2","lord":"B2","low":"A2","lower":"B2","lung":"B2","maintain":"B2","majority":"B2","make":"A1","map":"A1","mass":"B2","massive":"B2","master":"B2","matching":"B2","material":"A2","maximum":"B2","means":"B2","measurement":"B2","medium":"B1","melt":"B2","military":"B2","mineral":"B2","minimum":"B2","minister":"B2","minor":"B2","minority":"B2","mission":"B2","mistake":"A1","mixed":"B2","model":"A1","modify":"B2","monitor":"B2","moral":"B2","motor":"B2","mount":"B2","multiple":"B2","multiply":"B2","mysterious":"B2","narrow":"A2","national":"A2","neat":"B2","negative":"A1","nerve":"B2","nevertheless":"B2","nightmare":"B2","notion":"B2","numerous":"B2","obey":"B2","object":"A1","objective":"B2","obligation":"B2","observation":"B2","observe":"B2","obtain":"B2","occasionally":"B2","offence":"B2","offend":"B2","offensive":"B2","official":"B1","opening":"B2","operate":"B2","opponent":"B2","oppose":"B2","opposed":"B2","opposition":"B2","organ":"B2","origin":"B2","otherwise":"B2","outcome":"B2","outer":"B2","outline":"B2","overall":"B2","owe":"B2","pace":"B2","package":"B1","panel":"B2","parliament":"B2","participant":"B2","partly":"B2","passage":"B2","patient":"A2","pension":"B2","permanent":"B2","permit":"B2","perspective":"B2","phase":"B2","phenomenon":"B2","philosophy":"B2","pick":"A2","picture":"A1","pile":"B2","pitch":"B2","plain":"B2","plot":"B1","plus":"B1","pointed":"B2","popularity":"B2","pose":"B2","position":"A2","positive":"A1","possess":"B2","potential":"B2","power":"A2","praise":"B2","pregnant":"B2","preparation":"B2","presence":"B2","preserve":"B2","price":"A1","prime":"B2","principle":"B2","print":"A2","priority":"B2","privacy":"B2","procedure":"B2","process":"A2","produce":"A2","professional":"A2","progress":"A2","project":"A1","proof":"B2","proposal":"B2","propose":"B2","prospect":"B2","protection":"B2","psychologist":"B2","psychology":"B2","publication":"B2","pupil":"B2","purchase":"B2","pure":"B2","pursue":"B2","range":"B1","rank":"B2","rapid":"B2","rapidly":"B2","rate":"A2","raw":"B2","reach":"A2","realistic":"B2","reasonable":"B2","recall":"B2","recover":"B2","reduction":"B2","regard":"B2","regional":"B2","register":"B2","regret":"B2","regulation":"B2","relatively":"B2","relevant":"B2","relief":"B2","rely":"B2","remark":"B2","representative":"B2","reputation":"B2","requirement":"B2","rescue":"B2","reserve":"B2","resident":"B2","resist":"B2","resolve":"B2","resort":"B2","retain":"B2","reveal":"B2","revolution":"B2","reward":"B2","rhythm":"B2","rid":"B2","root":"B2","round":"A2","routine":"A1","rub":"B2","rubber":"B2","rural":"B2","rush":"B2","sample":"B1","satellite":"B2","satisfied":"B2","satisfy":"B2","saving":"B2","scale":"B2","schedule":"A2","scheme":"B2","scream":"B2","screen":"A2","seat":"A2","sector":"B2","secure":"B2","seek":"B2","select":"B2","selection":"B2","self":"B2","senior":"B2","sense":"A2","sensitive":"B2","sentence":"A1","sequence":"B2","session":"B2","settle":"B2","severe":"B2","shade":"B2","shadow":"B2","shallow":"B2","shame":"B2","shape":"A2","shelter":"B2","shift":"B1","ship":"A2","shock":"B2","shocked":"B2","shooting":"B2","shot":"B2","significant":"B2","significantly":"B2","silence":"B2","silk":"B2","sincere":"B2","slave":"B2","slide":"B2","slight":"B2","slip":"B2","slope":"B2","solar":"B2","somewhat":"B2","soul":"B2","specialist":"B2","species":"B2","speed":"A2","spiritual":"B2","split":"B2","sponsor":"B2","spot":"B1","spread":"B1","stable":"B2","stage":"A2","stand":"A1","stare":"B2","status":"B2","steady":"B2","steel":"B2","steep":"B2","step":"A2","sticky":"B2","stiff":"B2","stock":"B2","stream":"B2","stretch":"B2","strict":"B2","strike":"B2","structure":"A2","struggle":"B2","stuff":"B1","subject":"A1","submit":"B2","sum":"B2","surgery":"B2","surround":"B2","surrounding":"B2","survey":"A2","suspect":"B2","swear":"B2","sweep":"B2","switch":"B1","sympathy":"B2","tale":"B2","tank":"B2","target":"A2","tear":"B2","temporary":"B2","term":"A2","therapy":"B2","threat":"B2","threaten":"B2","thus":"B2","time":"A1","title":"A1","tone":"B2","tough":"B2","track":"A2","transfer":"B2","transform":"B2","transition":"B2","trial":"B2","trip":"A1","tropical":"B2","trouble":"A2","truly":"B2","trust":"B2","try":"A1","tune":"B2","tunnel":"B2","ultimately":"B2","unconscious":"B2","unexpected":"B2","unique":"B2","universe":"B2","unknown":"B2","upper":"B2","upwards":"B2","urban":"B2","urge":"B2","value":"B1","vary":"B2","vast":"B2","venue":"B2","very":"A1","via":"B2","victory":"B2","violence":"B2","virtual":"B2","vision":"B2","visual":"B2","vital":"B2","vitamin":"B2","volume":"B2","wage":"B2","way":"A1","weakness":"B2","wealth":"B2","wealthy":"B2","whereas":"B2","wherever":"B2","whisper":"B2","whom":"B2","widely":"B2","wildlife":"B2","willing":"B2","wind":"A2","wire":"B2","wise":"B2","witness":"B2","worse":"A2","worst":"A2","worth":"B1","wound":"B2","wrap":"B2","wrong":"A1","yet":"A2","zone":"B2","absolutely":"B1","access":"B1","accommodation":"B1","achievement":"B1","act":"A2","ad":"B1","addition":"B1","admire":"B1","admit":"B1","advanced":"B1","advise":"B1","afford":"B1","age":"A1","aged":"B1","agent":"B1","agreement":"B1","ahead":"B1","aim":"B1","album":"B1","alcohol":"B1","alcoholic":"B1","alternative":"A2","amazed":"B1","ambition":"B1","ambitious":"B1","analyse":"B1","analysis":"B1","announce":"B1","announcement":"B1","annoy":"B1","annoyed":"B1","annoying":"B1","apart":"B1","apologize":"B1","application":"B1","appointment":"B1","appreciate":"B1","approximately":"B1","arrest":"B1","arrival":"B1","assignment":"B1","assist":"B1","atmosphere":"B1","attach":"B1","attitude":"B1","attract":"B1","attraction":"B1","authority":"B1","average":"A2","award":"A2","aware":"B1","backwards":"B1","bake":"B1","balance":"B1","ban":"B1","bank":"A1","base":"B1","basic":"B1","basis":"B1","battery":"B1","beauty":"B1","bee":"B1","belief":"B1","bell":"B1","bend":"B1","benefit":"A2","better":"A1","bite":"B1","block":"B1","board":"A2","bomb":"B1","bother":"B1","branch":"B1","brand":"B1","brave":"B1","breath":"B1","breathe":"B1","breathing":"B1","bride":"B1","bubble":"B1","bury":"B1","by":"A1","calm":"B1","campaign":"B1","campus":"B1","candidate":"B1","cap":"B1","captain":"B1","careless":"B1","category":"B1","ceiling":"B1","celebration":"B1","central":"B1","centre":"A1","ceremony":"B1","champion":"B1","channel":"B1","chapter":"B1","charge":"B1","cheap":"A1","cheat":"B1","cheerful":"B1","chemical":"B1","chest":"B1","childhood":"B1","claim":"B1","clause":"B1","clear":"A2","click":"B1","client":"B1","climb":"A1","cloth":"B1","clue":"B1","coach":"A2","coal":"B1","coin":"B1","collection":"B1","coloured":"B1","combine":"B1","comment":"A2","commercial":"B1","commit":"B1","communication":"B1","comparison":"B1","competitive":"B1","competitor":"B1","complaint":"B1","concentrate":"B1","conclude":"B1","conclusion":"B1","confident":"B1","confirm":"B1","confuse":"B1","confused":"B1","connection":"B1","consequence":"B1","consist":"B1","consume":"B1","consumer":"B1","contact":"B1","container":"B1","content":"B1","continuous":"B1","contrast":"B1","convenient":"B1","convince":"B1","cool":"A1","costume":"B1","cottage":"B1","cotton":"B1","count":"A2","countryside":"B1","court":"B1","cover":"A2","covered":"B1","cream":"A1","criminal":"A2","cruel":"B1","cultural":"B1","currency":"B1","currently":"B1","curtain":"B1","custom":"B1","cut":"A1","daily":"A2","damage":"B1","deal":"A2","decade":"B1","decorate":"B1","deep":"A2","define":"B1","definite":"B1","definition":"B1","deliver":"B1","departure":"B1","despite":"B1","destination":"B1","determine":"B1","determined":"B1","development":"B1","diagram":"B1","diamond":"B1","difficulty":"B1","direct":"A2","directly":"B1","dirt":"B1","disadvantage":"B1","disappointed":"B1","disappointing":"B1","dislike":"B1","documentary":"B1","donate":"B1","double":"A2","doubt":"B1","dressed":"B1","drop":"A2","drum":"B1","drunk":"B1","due":"B1","dust":"B1","duty":"B1","earthquake":"B1","eastern":"B1","economic":"B1","economy":"B1","edge":"B1","editor":"B1","educate":"B1","educated":"B1","educational":"B1","effective":"B1","effectively":"B1","effort":"B1","election":"B1","element":"B1","embarrassed":"B1","embarrassing":"B1","emergency":"B1","emotion":"B1","employment":"B1","empty":"A2","encourage":"B1","enemy":"B1","engaged":"B1","engineering":"B1","entertain":"B1","entertainment":"B1","entrance":"B1","entry":"B1","environmental":"B1","episode":"B1","equally":"B1","escape":"B1","essential":"B1","eventually":"B1","examine":"B1","except":"A2","exchange":"B1","excitement":"B1","exhibition":"B1","expand":"B1","expected":"B1","expedition":"B1","experience":"A2","experienced":"B1","experiment":"A2","explode":"B1","explore":"B1","explosion":"B1","export":"B1","extra":"A1","face":"A1","fairly":"B1","familiar":"B1","fancy":"B1","far":"A1","fascinating":"B1","fashionable":"B1","fasten":"B1","fear":"A2","feature":"A2","fence":"B1","fighting":"B1","financial":"B1","fire":"A1","fitness":"B1","fixed":"B1","flag":"B1","flood":"B1","flour":"B1","flow":"B1","folk":"B1","force":"B1","forever":"B1","frame":"B1","freeze":"B1","frequently":"B1","friendship":"B1","frighten":"B1","frightened":"B1","frightening":"B1","frozen":"B1","fry":"B1","fur":"B1","further":"A2","garage":"B1","gather":"B1","generally":"B1","generation":"B1","generous":"B1","gentle":"B1","gentleman":"B1","ghost":"B1","giant":"B1","glad":"B1","global":"B1","glove":"B1","go":"A1","goods":"B1","graduate":"B1","grain":"B1","grateful":"B1","growth":"B1","guard":"B1","guilty":"B1","hand":"A1","hang":"B1","happiness":"B1","hardly":"B1","hate":"A1","head":"A1","headline":"B1","heating":"B1","heavily":"B1","helicopter":"B1","highlight":"B1","highly":"B1","historic":"B1","historical":"B1","honest":"B1","horrible":"B1","horror":"B1","hurricane":"B1","hurry":"B1","identity":"B1","ignore":"B1","illegal":"B1","imaginary":"B1","immediate":"B1","immigrant":"B1","impact":"B1","import":"B1","importance":"B1","impression":"B1","impressive":"B1","improvement":"B1","incredibly":"B1","indeed":"B1","indicate":"B1","indirect":"B1","indoor":"B1","indoors":"B1","influence":"B1","ingredient":"B1","injure":"B1","injured":"B1","innocent":"B1","intelligence":"B1","intend":"B1","intention":"B1","invest":"B1","investigate":"B1","involved":"B1","iron":"B1","it":"A1","journal":"B1","judge":"B1","keen":"B1","key":"A1","keyboard":"B1","kick":"B1","killing":"B1","kind":"A1","kiss":"B1","knock":"A2","label":"B1","laboratory":"B1","lack":"B1","lay":"B1","layer":"B1","lead":"A2","leading":"B1","leaf":"B1","leather":"B1","legal":"B1","leisure":"B1","length":"B1","lie":"A1","like":"A1","limit":"B1","lip":"B1","liquid":"B1","literature":"B1","live":"A1","living":"B1","local":"A1","locate":"B1","located":"B1","location":"B1","lonely":"B1","loss":"B1","luxury":"B1","mad":"B1","magic":"B1","mainly":"B1","mall":"B1","management":"B1","market":"A1","marketing":"B1","marriage":"B1","meanwhile":"B1","measure":"B1","mental":"B1","mention":"A2","mess":"B1","mild":"B1","mine":"A2","mix":"B1","mixture":"B1","mood":"B1","move":"A1","mud":"B1","murder":"B1","muscle":"B1","musical":"A2","mystery":"B1","nail":"B1","narrative":"B1","nation":"B1","native":"B1","naturally":"B1","necessarily":"B1","need":"A1","needle":"B1","neighbourhood":"B1","neither":"A2","net":"B1","next":"A1","nor":"B1","normal":"A2","northern":"B1","note":"A1","now":"A1","nuclear":"B1","obvious":"B1","obviously":"B1","occasion":"B1","occur":"B1","odd":"B1","old-fashioned":"B1","once":"A1","operation":"B1","organized":"B1","organizer":"B1","original":"A2","originally":"B1","ought":"B1","ours":"B1","outdoor":"B1","outdoors":"B1","pack":"A2","painful":"B1","pale":"B1","pan":"B1","participate":"B1","particularly":"B1","pass":"A2","passion":"B1","path":"B1","payment":"B1","peaceful":"B1","percentage":"B1","perfectly":"B1","performance":"B1","personally":"B1","persuade":"B1","photographer":"B1","photography":"B1","pin":"B1","pipe":"B1","place":"A1","planning":"B1","pleasant":"B1","pleasure":"B1","plenty":"B1","poem":"B1","poet":"B1","poetry":"B1","point":"A1","poison":"B1","poisonous":"B1","policy":"B1","political":"B1","politician":"B1","politics":"B1","port":"B1","portrait":"B1","possibly":"B1","pot":"B1","pour":"B1","poverty":"B1","powder":"B1","powerful":"B1","practical":"B1","pray":"B1","prayer":"B1","prediction":"B1","prepared":"B1","presentation":"B1","press":"B1","pressure":"B1","pretend":"B1","previous":"B1","previously":"B1","priest":"B1","primary":"B1","prince":"B1","princess":"B1","printing":"B1","prisoner":"B1","private":"B1","producer":"B1","production":"B1","profession":"B1","profit":"B1","program":"A2","promote":"B1","proper":"B1","properly":"B1","property":"B1","protest":"B1","proud":"B1","prove":"B1","pull":"A2","punish":"B1","punishment":"B1","push":"A2","qualification":"B1","qualified":"B1","qualify":"B1","queue":"B1","quit":"B1","quotation":"B1","quote":"B1","race":"A2","racing":"B1","rare":"B1","rarely":"B1","reaction":"B1","reality":"B1","receipt":"B1","recommendation":"B1","reference":"B1","reflect":"B1","regularly":"B1","reject":"B1","relate":"B1","related":"B1","relation":"B1","relative":"B1","relaxed":"B1","relaxing":"B1","release":"B1","reliable":"B1","religion":"B1","religious":"B1","remain":"B1","remind":"B1","remote":"B1","rent":"B1","repair":"A2","repeat":"A1","repeated":"B1","represent":"B1","request":"A2","require":"B1","reservation":"B1","resource":"B1","respect":"B1","responsibility":"B1","responsible":"B1","result":"A1","retire":"B1","retired":"B1","revise":"B1","ring":"A2","rise":"A2","risk":"B1","robot":"B1","roll":"B1","romantic":"B1","rope":"B1","rough":"B1","row":"B1","royal":"B1","rugby":"B1","rule":"A1","safety":"B1","sail":"A2","sailor":"B1","sand":"B1","scan":"B1","scientific":"B1","script":"B1","sculpture":"B1","secondary":"B1","security":"B1","seed":"B1","sensible":"B1","separate":"A2","seriously":"B1","servant":"B1","set":"B1","setting":"B1","sex":"B1","sexual":"B1","shake":"A2","share":"A1","sharp":"B1","shelf":"B1","shell":"B1","shine":"B1","shiny":"B1","shoot":"B1","shy":"B1","sight":"B1","signal":"B1","silent":"B1","silly":"B1","similarity":"B1","similarly":"B1","simply":"B1","since":"A2","sink":"B1","slice":"B1","slightly":"B1","slow":"A1","smart":"B1","smooth":"B1","software":"B1","soil":"B1","solid":"B1","sort":"A2","southern":"B1","specifically":"B1","spending":"B1","spicy":"B1","spirit":"B1","spoken":"B1","spring":"A1","stadium":"B1","staff":"B1","standard":"B1","state":"A2","statistic":"B1","statue":"B1","stick":"B1","still":"A1","store":"A2","stranger":"B1","strength":"B1","string":"B1","strongly":"B1","studio":"B1","substance":"B1","successfully":"B1","sudden":"B1","suffer":"B1","suit":"A2","suitable":"B1","summarize":"B1","summary":"B1","supply":"B1","supporter":"B1","surely":"B1","surface":"B1","survive":"B1","swim":"A1","symptom":"B1","tail":"B1","talent":"B1","talented":"B1","tape":"B1","tax":"B1","technical":"B1","technique":"B1","tend":"B1","tent":"B1","that":"A1","theirs":"B1","theme":"B1","theory":"B1","therefore":"B1","this":"A1","though":"B1","throat":"B1","throughout":"B1","tight":"B1","till":"B1","tin":"B1","tiny":"B1","tip":"A2","toe":"B1","tongue":"B1","total":"B1","totally":"B1","touch":"A2","tour":"A2","trade":"B1","translate":"B1","translation":"B1","transport":"A2","treat":"B1","treatment":"B1","trend":"B1","trick":"B1","truth":"B1","tube":"B1","type":"A1","typically":"B1","tyre":"B1","ugly":"B1","unable":"B1","uncomfortable":"B1","underwear":"B1","unemployed":"B1","unemployment":"B1","unfair":"B1","union":"B1","unless":"B1","unlike":"B1","unlikely":"B1","unnecessary":"B1","unpleasant":"B1","update":"B1","upon":"B1","upset":"B1","used":"A2","valuable":"B1","various":"B1","version":"B1","victim":"B1","view":"A2","viewer":"B1","violent":"B1","volunteer":"B1","vote":"B1","warm":"A1","warn":"B1","warning":"B1","waste":"B1","water":"A1","wave":"A2","weapon":"B1","weigh":"B1","western":"B1","whatever":"B1","whenever":"B1","whether":"B1","while":"A2","whole":"A2","will":"A1","win":"A1","wing":"B1","within":"B1","wonder":"B1","wool":"B1","worldwide":"B1","worry":"A2","written":"B1","yard":"B1","young":"A1","youth":"B1","ability":"A2","able":"A2","abroad":"A2","accept":"A2","accident":"A2","according":"A2","achieve":"A2","active":"A2","actually":"A2","adult":"A1","advantage":"A2","adventure":"A2","advertise":"A2","advertisement":"A2","advertising":"A2","affect":"A2","after":"A1","against":"A2","ah":"A2","airline":"A2","alive":"A2","all":"A1","allow":"A2","almost":"A2","alone":"A2","along":"A2","already":"A2","although":"A2","among":"A2","ancient":"A2","ankle":"A2","any":"A1","anybody":"A2","anyway":"A2","anywhere":"A2","app":"A2","appear":"A2","appearance":"A2","apply":"A2","architect":"A2","architecture":"A2","argue":"A2","argument":"A2","army":"A2","arrange":"A2","arrangement":"A2","as":"A1","asleep":"A2","assistant":"A2","athlete":"A2","attack":"A2","attend":"A2","attention":"A2","attractive":"A2","audience":"A2","author":"A2","available":"A2","avoid":"A2","awful":"A2","background":"A2","badly":"A2","baseball":"A2","based":"A2","basketball":"A2","bean":"A2","beef":"A2","before":"A1","behave":"A2","behaviour":"A2","belong":"A2","belt":"A2","best":"A1","between":"A1","billion":"A2","bin":"A2","biology":"A2","birth":"A2","biscuit":"A2","bit":"A2","blank":"A2","blood":"A2","blow":"A2","boil":"A2","bone":"A2","book":"A1","borrow":"A2","boss":"A2","bottom":"A2","bowl":"A2","brain":"A2","bridge":"A2","bright":"A2","brilliant":"A2","broken":"A2","brush":"A2","businessman":"A2","button":"A2","camp":"A2","camping":"A2","can":"A1","care":"A2","careful":"A2","carefully":"A2","carpet":"A2","cartoon":"A2","case":"A2","cash":"A2","castle":"A2","cause":"A2","celebrate":"A2","celebrity":"A2","certain":"A2","certainly":"A2","chance":"A2","character":"A2","charity":"A2","chat":"A2","check":"A1","chef":"A2","chemistry":"A2","chip":"A2","choice":"A2","church":"A2","cigarette":"A2","circle":"A2","classical":"A2","clearly":"A2","clever":"A2","climate":"A2","closed":"A2","clothing":"A2","cloud":"A2","coast":"A2","code":"A2","colleague":"A2","collect":"A2","column":"A2","comedy":"A2","comfortable":"A2","communicate":"A2","community":"A2","compete":"A2","competition":"A2","complain":"A2","completely":"A2","condition":"A2","conference":"A2","connect":"A2","connected":"A2","consider":"A2","contain":"A2","context":"A2","continent":"A2","continue":"A2","control":"A2","cook":"A1","cooker":"A2","copy":"A2","corner":"A2","correctly":"A2","couple":"A2","crazy":"A2","creative":"A2","crime":"A2","cross":"A2","crowd":"A2","crowded":"A2","cupboard":"A2","curly":"A2","cycle":"A2","danger":"A2","dark":"A1","data":"A2","dead":"A2","dear":"A1","death":"A2","decision":"A2","definitely":"A2","degree":"A2","dentist":"A2","department":"A2","depend":"A2","designer":"A2","destroy":"A2","detective":"A2","develop":"A2","device":"A2","diary":"A2","differently":"A2","digital":"A2","direction":"A2","director":"A2","disagree":"A2","disappear":"A2","disaster":"A2","discover":"A2","discovery":"A2","discussion":"A2","disease":"A2","distance":"A2","divorced":"A2","download":"A2","downstairs":"A1","drama":"A2","drawing":"A2","dream":"A2","drive":"A1","driving":"A2","drug":"A2","dry":"A2","earn":"A2","earth":"A2","easily":"A2","education":"A2","effect":"A2","either":"A2","electric":"A2","electrical":"A2","electricity":"A2","electronic":"A2","employ":"A2","employee":"A2","employer":"A2","ending":"A2","energy":"A2","engine":"A2","engineer":"A2","enormous":"A2","enter":"A2","environment":"A2","equipment":"A2","error":"A2","especially":"A2","essay":"A2","everyday":"A2","everywhere":"A2","evidence":"A2","exact":"A2","exactly":"A2","excellent":"A2","exist":"A2","expect":"A2","expert":"A2","explanation":"A2","express":"A2","expression":"A2","extremely":"A2","factor":"A2","factory":"A2","fail":"A2","fair":"A2","fall":"A1","fan":"A2","farm":"A1","farming":"A2","fashion":"A2","fat":"A1","female":"A2","fiction":"A2","field":"A2","fight":"A2","film":"A1","final":"A1","finally":"A2","finger":"A2","finish":"A1","first":"A1","firstly":"A2","fish":"A1","fishing":"A2","fit":"A2","flat":"A1","flu":"A2","fly":"A1","flying":"A2","focus":"A2","foreign":"A2","forest":"A2","fork":"A2","formal":"A2","fortunately":"A2","fresh":"A2","fridge":"A2","frog":"A2","fun":"A1","furniture":"A2","future":"A1","gallery":"A2","gap":"A2","gas":"A2","gate":"A2","general":"A2","gift":"A2","goal":"A2","god":"A2","gold":"A2","golf":"A2","good":"A1","government":"A2","grass":"A2","greet":"A2","ground":"A2","guest":"A2","guide":"A2","gun":"A2","guy":"A2","habit":"A2","half":"A1","hall":"A2","happily":"A2","have":"A1","headache":"A2","heart":"A2","heat":"A2","heavy":"A2","height":"A2","helpful":"A2","hero":"A2","hers":"A2","herself":"A2","hide":"A2","hill":"A2","himself":"A2","his":"A1","hit":"A2","hockey":"A2","hole":"A2","home":"A1","hope":"A1","huge":"A2","human":"A2","identify":"A2","ill":"A2","illness":"A2","image":"A2","immediately":"A2","impossible":"A2","included":"A2","including":"A2","increase":"A2","incredible":"A2","independent":"A2","individual":"A2","industry":"A2","informal":"A2","injury":"A2","insect":"A2","inside":"A2","instead":"A2","instruction":"A2","instructor":"A2","instrument":"A2","intelligent":"A2","international":"A2","introduction":"A2","invent":"A2","invention":"A2","invitation":"A2","invite":"A2","involve":"A2","item":"A2","itself":"A2","jam":"A2","jazz":"A2","jewellery":"A2","joke":"A2","journalist":"A2","jump":"A2","kid":"A2","kill":"A2","king":"A2","knee":"A2","knife":"A2","knowledge":"A2","lab":"A2","lady":"A2","lake":"A2","lamp":"A2","land":"A1","laptop":"A2","last":"A1","later":"A1","laughter":"A2","law":"A2","lawyer":"A2","lazy":"A2","leader":"A2","learning":"A2","least":"A2","lecture":"A2","lemon":"A2","lend":"A2","less":"A2","lifestyle":"A2","lift":"A2","light":"A1","likely":"A2","link":"A2","listener":"A2","little":"A1","lock":"A2","look":"A1","lorry":"A2","lost":"A2","loud":"A2","loudly":"A2","lovely":"A2","luck":"A2","lucky":"A2","mail":"A2","major":"A2","male":"A2","manage":"A2","manager":"A2","manner":"A2","mark":"A2","marry":"A2","mathematics":"A2","maths":"A2","matter":"A2","may":"A1","media":"A2","medical":"A2","medicine":"A2","memory":"A2","metal":"A2","method":"A2","middle":"A2","might":"A2","mind":"A2","mirror":"A2","missing":"A2","mobile":"A2","monkey":"A2","moon":"A2","mostly":"A2","motorcycle":"A2","movement":"A2","musician":"A2","myself":"A2","nature":"A2","nearly":"A2","necessary":"A2","neck":"A2","nervous":"A2","network":"A2","noise":"A2","noisy":"A2","none":"A2","normally":"A2","notice":"A2","novel":"A2","nowhere":"A2","number":"A1","nut":"A2","ocean":"A2","offer":"A2","officer":"A2","oil":"A2","onto":"A2","opportunity":"A2","option":"A2","ordinary":"A2","organization":"A2","organize":"A2","ourselves":"A2","outside":"A1","oven":"A2","own":"A1","owner":"A2","pain":"A2","painter":"A2","palace":"A2","pants":"A2","parking":"A2","particular":"A2","passenger":"A2","past":"A1","pattern":"A2","pay":"A1","peace":"A2","penny":"A2","per":"A2","perform":"A2","perhaps":"A2","permission":"A2","personality":"A2","pet":"A2","petrol":"A2","photograph":"A1","physical":"A2","physics":"A2","pilot":"A2","planet":"A2","plant":"A1","plastic":"A2","plate":"A2","platform":"A2","please":"A1","pleased":"A2","pocket":"A2","polite":"A2","pollution":"A2","pop":"A2","population":"A2","possession":"A2","possibility":"A2","poster":"A2","predict":"A2","present":"A1","president":"A2","prevent":"A2","printer":"A2","prison":"A2","prize":"A2","professor":"A2","profile":"A2","promise":"A2","pronounce":"A2","protect":"A2","provide":"A2","pub":"A2","public":"A2","publish":"A2","purpose":"A2","quality":"A2","quantity":"A2","queen":"A2","question":"A1","quietly":"A2","railway":"A2","raise":"A2","rather":"A2","react":"A2","realize":"A2","receive":"A2","recent":"A2","recently":"A2","reception":"A2","recipe":"A2","recognize":"A2","recommend":"A2","record":"A2","recording":"A2","recycle":"A2","reduce":"A2","refer":"A2","refuse":"A2","region":"A2","regular":"A2","relationship":"A2","remove":"A2","replace":"A2","reply":"A2","report":"A1","reporter":"A2","research":"A2","researcher":"A2","respond":"A2","response":"A2","rest":"A2","review":"A2","ride":"A1","rock":"A2","role":"A2","roof":"A2","route":"A2","rubbish":"A2","rude":"A2","run":"A1","runner":"A2","running":"A2","sadly":"A2","safe":"A2","sailing":"A2","salary":"A2","sale":"A2","sauce":"A2","save":"A2","scared":"A2","scary":"A2","scene":"A2","score":"A2","search":"A2","season":"A2","second":"A1","secondly":"A2","secret":"A2","secretary":"A2","seem":"A2","series":"A2","serious":"A2","serve":"A2","service":"A2","several":"A2","shall":"A2","sheet":"A2","shoulder":"A2","shout":"A2","shut":"A2","side":"A2","sign":"A2","silver":"A2","simple":"A2","singing":"A2","single":"A2","sir":"A2","site":"A2","size":"A2","ski":"A2","skiing":"A2","skin":"A2","sky":"A2","sleep":"A1","slowly":"A2","smartphone":"A2","smell":"A2","smile":"A2","smoke":"A2","smoking":"A2","soap":"A2","soccer":"A2","social":"A2","society":"A2","sock":"A2","soft":"A2","soldier":"A2","solution":"A2","solve":"A2","somewhere":"A2","source":"A2","speaker":"A2","specific":"A2","speech":"A2","spider":"A2","spoon":"A2","square":"A2","stair":"A2","stamp":"A2","star":"A1","start":"A1","stay":"A1","steal":"A2","stomach":"A2","stone":"A2","storm":"A2","straight":"A2","strange":"A2","strategy":"A2","stress":"A2","stupid":"A2","succeed":"A2","successful":"A2","such":"A2","suddenly":"A2","suggest":"A2","suggestion":"A2","support":"A2","suppose":"A2","sure":"A1","surprise":"A2","surprised":"A2","surprising":"A2","sweet":"A2","symbol":"A2","system":"A2","tablet":"A2","talk":"A1","task":"A2","taste":"A2","teaching":"A2","technology":"A2","teenage":"A2","temperature":"A2","text":"A1","themselves":"A2","thick":"A2","thief":"A2","thin":"A2","thinking":"A2","third":"A1","thought":"A2","throw":"A2","tidy":"A2","tie":"A2","tool":"A2","top":"A2","tourism":"A2","towards":"A2","towel":"A2","tower":"A2","toy":"A2","tradition":"A2","traditional":"A2","train":"A1","trainer":"A2","training":"A2","traveller":"A2","truck":"A2","twin":"A2","typical":"A2","underground":"A2","understanding":"A2","unfortunately":"A2","unhappy":"A2","uniform":"A2","unit":"A2","united":"A2","unusual":"A2","upstairs":"A1","use":"A1","user":"A2","usual":"A2","valley":"A2","van":"A2","variety":"A2","vehicle":"A2","virus":"A2","voice":"A2","wait":"A1","war":"A2","wash":"A1","washing":"A2","weak":"A2","web":"A2","wedding":"A2","weight":"A2","welcome":"A1","wet":"A2","wheel":"A2","whose":"A2","wide":"A2","wild":"A2","winner":"A2","wish":"A2","wood":"A2","wooden":"A2","working":"A2","worried":"A2","wow":"A2","yours":"A2","zero":"A2","about":"A1","above":"A1","across":"A1","action":"A1","activity":"A1","actor":"A1","actress":"A1","add":"A1","advice":"A1","afraid":"A1","afternoon":"A1","again":"A1","ago":"A1","agree":"A1","air":"A1","airport":"A1","also":"A1","always":"A1","amazing":"A1","and":"A1","angry":"A1","animal":"A1","another":"A1","answer":"A1","anyone":"A1","anything":"A1","apartment":"A1","apple":"A1","april":"A1","area":"A1","arm":"A1","around":"A1","arrive":"A1","art":"A1","article":"A1","artist":"A1","ask":"A1","at":"A1","august":"A1","aunt":"A1","autumn":"A1","away":"A1","baby":"A1","bad":"A1","bag":"A1","ball":"A1","banana":"A1","band":"A1","bath":"A1","bathroom":"A1","be":"A1","beach":"A1","beautiful":"A1","because":"A1","become":"A1","bed":"A1","bedroom":"A1","beer":"A1","begin":"A1","beginning":"A1","behind":"A1","believe":"A1","below":"A1","bicycle":"A1","big":"A1","bike":"A1","bird":"A1","birthday":"A1","black":"A1","blog":"A1","blonde":"A1","blue":"A1","boat":"A1","body":"A1","boot":"A1","bored":"A1","boring":"A1","born":"A1","both":"A1","bottle":"A1","box":"A1","boy":"A1","boyfriend":"A1","bread":"A1","break":"A1","breakfast":"A1","bring":"A1","brother":"A1","brown":"A1","build":"A1","building":"A1","bus":"A1","business":"A1","busy":"A1","butter":"A1","buy":"A1","bye":"A1","cafe":"A1","cake":"A1","call":"A1","camera":"A1","cannot":"A1","capital":"A1","car":"A1","card":"A1","career":"A1","carrot":"A1","carry":"A1","cat":"A1","cd":"A1","cent":"A1","century":"A1","change":"A1","cheese":"A1","chicken":"A1","child":"A1","chocolate":"A1","choose":"A1","cinema":"A1","city":"A1","class":"A1","classroom":"A1","clean":"A1","clock":"A1","clothes":"A1","club":"A1","coat":"A1","coffee":"A1","cold":"A1","college":"A1","colour":"A1","come":"A1","common":"A1","company":"A1","compare":"A1","complete":"A1","computer":"A1","concert":"A1","conversation":"A1","cooking":"A1","correct":"A1","cost":"A1","could":"A1","country":"A1","course":"A1","cousin":"A1","cow":"A1","create":"A1","culture":"A1","cup":"A1","customer":"A1","dad":"A1","dance":"A1","dancer":"A1","dancing":"A1","dangerous":"A1","daughter":"A1","day":"A1","december":"A1","decide":"A1","delicious":"A1","describe":"A1","description":"A1","design":"A1","desk":"A1","dialogue":"A1","dictionary":"A1","die":"A1","diet":"A1","difference":"A1","different":"A1","difficult":"A1","dinner":"A1","dirty":"A1","discuss":"A1","dish":"A1","do":"A1","doctor":"A1","dog":"A1","dollar":"A1","door":"A1","down":"A1","draw":"A1","dress":"A1","drink":"A1","driver":"A1","during":"A1","dvd":"A1","each":"A1","ear":"A1","early":"A1","east":"A1","easy":"A1","eat":"A1","egg":"A1","eight":"A1","eighteen":"A1","eighty":"A1","elephant":"A1","eleven":"A1","else":"A1","email":"A1","end":"A1","enjoy":"A1","enough":"A1","euro":"A1","evening":"A1","event":"A1","ever":"A1","every":"A1","everybody":"A1","everyone":"A1","everything":"A1","exam":"A1","example":"A1","excited":"A1","exciting":"A1","exercise":"A1","expensive":"A1","explain":"A1","eye":"A1","fact":"A1","false":"A1","family":"A1","famous":"A1","fantastic":"A1","farmer":"A1","fast":"A1","father":"A1","favourite":"A1","february":"A1","feeling":"A1","festival":"A1","few":"A1","fifteen":"A1","fifth":"A1","fifty":"A1","fill":"A1","find":"A1","fine":"A1","five":"A1","flight":"A1","floor":"A1","flower":"A1","follow":"A1","food":"A1","foot":"A1","football":"A1","for":"A1","forget":"A1","form":"A1","forty":"A1","four":"A1","fourteen":"A1","fourth":"A1","friday":"A1","friend":"A1","friendly":"A1","from":"A1","front":"A1","fruit":"A1","full":"A1","funny":"A1","game":"A1","garden":"A1","geography":"A1","get":"A1","girl":"A1","girlfriend":"A1","give":"A1","glass":"A1","goodbye":"A1","grandfather":"A1","grandmother":"A1","grandparent":"A1","great":"A1","green":"A1","grey":"A1","group":"A1","grow":"A1","guess":"A1","guitar":"A1","gym":"A1","hair":"A1","happen":"A1","happy":"A1","hard":"A1","hat":"A1","he":"A1","health":"A1","healthy":"A1","hear":"A1","hello":"A1","help":"A1","her":"A1","here":"A1","hey":"A1","hi":"A1","him":"A1","history":"A1","hobby":"A1","holiday":"A1","homework":"A1","horse":"A1","hospital":"A1","hot":"A1","hotel":"A1","hour":"A1","how":"A1","however":"A1","hundred":"A1","hungry":"A1","husband":"A1","i":"A1","ice":"A1","idea":"A1","if":"A1","imagine":"A1","important":"A1","improve":"A1","in":"A1","include":"A1","information":"A1","interest":"A1","interested":"A1","interesting":"A1","internet":"A1","interview":"A1","into":"A1","introduce":"A1","island":"A1","its":"A1","jacket":"A1","january":"A1","jeans":"A1","job":"A1","join":"A1","journey":"A1","juice":"A1","july":"A1","june":"A1","just":"A1","keep":"A1","kilometre":"A1","kitchen":"A1","know":"A1","language":"A1","large":"A1","late":"A1","laugh":"A1","learn":"A1","left":"A1","leg":"A1","lesson":"A1","let":"A1","letter":"A1","library":"A1","life":"A1","lion":"A1","list":"A1","listen":"A1","long":"A1","lose":"A1","lot":"A1","love":"A1","lunch":"A1","machine":"A1","magazine":"A1","main":"A1","man":"A1","many":"A1","march":"A1","married":"A1","match":"A1","maybe":"A1","me":"A1","meal":"A1","mean":"A1","meaning":"A1","meat":"A1","meet":"A1","meeting":"A1","member":"A1","menu":"A1","message":"A1","metre":"A1","midnight":"A1","mile":"A1","milk":"A1","million":"A1","minute":"A1","miss":"A1","modern":"A1","moment":"A1","monday":"A1","money":"A1","month":"A1","more":"A1","morning":"A1","most":"A1","mother":"A1","mountain":"A1","mouse":"A1","mouth":"A1","movie":"A1","much":"A1","mum":"A1","museum":"A1","music":"A1","must":"A1","my":"A1","name":"A1","natural":"A1","near":"A1","neighbour":"A1","never":"A1","new":"A1","news":"A1","newspaper":"A1","nice":"A1","night":"A1","nine":"A1","nineteen":"A1","ninety":"A1","no":"A1","nobody":"A1","north":"A1","nose":"A1","not":"A1","nothing":"A1","november":"A1","nurse":"A1","october":"A1","of":"A1","off":"A1","office":"A1","often":"A1","oh":"A1","ok":"A1","old":"A1","on":"A1","one":"A1","onion":"A1","online":"A1","only":"A1","open":"A1","opinion":"A1","opposite":"A1","or":"A1","orange":"A1","order":"A1","other":"A1","our":"A1","out":"A1","over":"A1","page":"A1","paint":"A1","painting":"A1","pair":"A1","paper":"A1","paragraph":"A1","parent":"A1","park":"A1","part":"A1","partner":"A1","party":"A1","passport":"A1","pen":"A1","pencil":"A1","people":"A1","pepper":"A1","perfect":"A1","period":"A1","person":"A1","personal":"A1","phone":"A1","photo":"A1","phrase":"A1","piano":"A1","piece":"A1","pig":"A1","pink":"A1","plan":"A1","plane":"A1","play":"A1","player":"A1","police":"A1","policeman":"A1","pool":"A1","poor":"A1","popular":"A1","possible":"A1","post":"A1","potato":"A1","pound":"A1","practice":"A1","practise":"A1","prefer":"A1","prepare":"A1","pretty":"A1","probably":"A1","problem":"A1","product":"A1","programme":"A1","purple":"A1","put":"A1","quarter":"A1","quick":"A1","quickly":"A1","quiet":"A1","quite":"A1","radio":"A1","rain":"A1","read":"A1","reader":"A1","reading":"A1","ready":"A1","real":"A1","really":"A1","reason":"A1","red":"A1","relax":"A1","remember":"A1","restaurant":"A1","return":"A1","rice":"A1","rich":"A1","right":"A1","river":"A1","road":"A1","room":"A1","sad":"A1","salad":"A1","salt":"A1","same":"A1","sandwich":"A1","saturday":"A1","say":"A1","school":"A1","science":"A1","scientist":"A1","sea":"A1","section":"A1","see":"A1","sell":"A1","send":"A1","september":"A1","seven":"A1","seventeen":"A1","seventy":"A1","she":"A1","sheep":"A1","shirt":"A1","shoe":"A1","shop":"A1","shopping":"A1","short":"A1","should":"A1","show":"A1","shower":"A1","sick":"A1","similar":"A1","sing":"A1","singer":"A1","sister":"A1","sit":"A1","situation":"A1","six":"A1","sixteen":"A1","sixty":"A1","skill":"A1","skirt":"A1","small":"A1","snake":"A1","snow":"A1","so":"A1","some":"A1","somebody":"A1","someone":"A1","something":"A1","sometimes":"A1","son":"A1","song":"A1","soon":"A1","sorry":"A1","sound":"A1","soup":"A1","south":"A1","space":"A1","speak":"A1","special":"A1","spell":"A1","spelling":"A1","spend":"A1","sport":"A1","statement":"A1","station":"A1","stop":"A1","story":"A1","street":"A1","strong":"A1","student":"A1","study":"A1","style":"A1","success":"A1","sugar":"A1","summer":"A1","sun":"A1","sunday":"A1","supermarket":"A1","sweater":"A1","swimming":"A1","t-shirt":"A1","table":"A1","take":"A1","tall":"A1","taxi":"A1","tea":"A1","teach":"A1","teacher":"A1","team":"A1","teenager":"A1","telephone":"A1","television":"A1","tell":"A1","ten":"A1","tennis":"A1","terrible":"A1","test":"A1","than":"A1","thank":"A1","thanks":"A1","the":"A1","theatre":"A1","their":"A1","them":"A1","then":"A1","there":"A1","they":"A1","thing":"A1","think":"A1","thirsty":"A1","thirteen":"A1","thirty":"A1","thousand":"A1","three":"A1","through":"A1","thursday":"A1","ticket":"A1","tired":"A1","to":"A1","today":"A1","together":"A1","toilet":"A1","tomato":"A1","tomorrow":"A1","tonight":"A1","too":"A1","tooth":"A1","topic":"A1","tourist":"A1","town":"A1","traffic":"A1","travel":"A1","tree":"A1","trousers":"A1","true":"A1","tuesday":"A1","turn":"A1","tv":"A1","twelve":"A1","twenty":"A1","twice":"A1","two":"A1","umbrella":"A1","uncle":"A1","under":"A1","understand":"A1","university":"A1","until":"A1","up":"A1","us":"A1","useful":"A1","usually":"A1","vacation":"A1","vegetable":"A1","video":"A1","village":"A1","visit":"A1","visitor":"A1","waiter":"A1","wake":"A1","walk":"A1","wall":"A1","want":"A1","watch":"A1","we":"A1","wear":"A1","weather":"A1","website":"A1","wednesday":"A1","week":"A1","weekend":"A1","well":"A1","west":"A1","what":"A1","when":"A1","where":"A1","which":"A1","white":"A1","who":"A1","why":"A1","wife":"A1","window":"A1","wine":"A1","winter":"A1","with":"A1","without":"A1","woman":"A1","wonderful":"A1","word":"A1","work":"A1","worker":"A1","world":"A1","would":"A1","write":"A1","writer":"A1","writing":"A1","yeah":"A1","year":"A1","yellow":"A1","yes":"A1","yesterday":"A1","you":"A1","your":"A1","yourself":"A1"};

// ── SUPABASE CONFIG (fetch 직접 호출) ──
const SUPA_URL='https://pznpcewwdsbxwibpnapn.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bnBjZXd3ZHNieHdpYnBuYXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NjQ4NzUsImV4cCI6MjA5NTQ0MDg3NX0.fzXJKPfcxR-vrgsFbgt6-5sMEjtUH2p_rPsv6XjHe-c';
const SUPA_HEADERS={'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'};

// ── 어휘 레벨 조회 헬퍼 ──
const DOLCH_LABEL={pk:'Dolch Pre-K',k:'Dolch K',g1:'Dolch 1',g2:'Dolch 2',g3:'Dolch 3'};
function getWordLevel(word){
  const w=(word||'').toLowerCase().trim();
  const dolch=DOLCH_WORDS[w]||null;
  const cefr=OXFORD_CEFR[w]||null;
  const fry=FRY_WORDS[w]||null;
  const fryGroup=fry?'Fry '+Math.ceil(fry/100)+'00':'';
  const display=cefr||( dolch?DOLCH_LABEL[dolch]:'')||fryGroup;
  return {dolch,cefr,fry,display};
}

// fetch 기반 Supabase REST API 헬퍼
const supa={
  from(table){
    const base=SUPA_URL+'/rest/v1/'+table;
    return {
      async select(cols='*'){
        const r=await fetch(base+'?select='+cols,{headers:SUPA_HEADERS});
        if(!r.ok)throw new Error(await r.text());
        return {data:await r.json(),error:null};
      },
      async order(col,{ascending=true}={}){
        const dir=ascending?'asc':'desc';
        const r=await fetch(base+'?select=*&order='+col+'.'+dir,{headers:SUPA_HEADERS});
        if(!r.ok)throw new Error(await r.text());
        return {data:await r.json(),error:null};
      },
      async upsert(row,opts={}){
        const h={...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'};
        const r=await fetch(base,{method:'POST',headers:h,body:JSON.stringify(row)});
        if(!r.ok){const t=await r.text();return {error:{message:t}};}
        return {error:null};
      },
      async delete(){
        return {eq:async(col,val)=>{
          const r=await fetch(base+'?'+col+'=eq.'+encodeURIComponent(val),{method:'DELETE',headers:SUPA_HEADERS});
          if(!r.ok){const t=await r.text();return {error:{message:t}};}
          return {error:null};
        }};
      },
      eq(col,val){
        return {
          async single(){
            const r=await fetch(base+'?'+col+'=eq.'+encodeURIComponent(val)+'&limit=1',{headers:{...SUPA_HEADERS,'Accept':'application/vnd.pgrst.object+json'}});
            if(r.status===406||r.status===404)return {data:null,error:null};
            if(!r.ok)return {data:null,error:{message:await r.text()}};
            return {data:await r.json(),error:null};
          }
        };
      }
    };
  },
  channel(name){
    // Realtime — EventSource 기반 폴링으로 구현
    const handlers=[];
    return {
      on(event,filter,cb){handlers.push({event,filter,cb});return this;},
      subscribe(){startPolling(handlers);return this;}
    };
  }
};

// ── 인메모리 캐시 (Supabase → 로컬 캐시 → UI) ──
const _cache={
  students:[],lessons:[],tests:[],readings:[],logs:[],
  library:[],notices:[],settings:{},vocab_cards:[],homeworks:[],assignments:[],textbooks:[],messages:[],globalClasses:[],monthlyReports:[]
};

// ── DATA ──
// localStorage는 설정값(pw, apikey, cloud)만 유지
// 학생/수업/테스트/원서/로그/공지는 Supabase
const DB={
  // localStorage 전용 (기기별 설정)
  g(k){try{return JSON.parse(localStorage.getItem('pp_'+k)||'null');}catch{return null;}},
  s(k,v){localStorage.setItem('pp_'+k,JSON.stringify(v));},
  pw(){return _cache.settings.pw||this.g('pw')||'pencil2025';},
  cld(){return this.g('cloud')||{name:'',preset:''};},
  api(){return _cache.settings.apikey||this.g('apikey')||'';},
  gbooks(){return _cache.settings.gbooks_key||this.g('gbooks_key')||'';},
  kakao(){return _cache.settings.kakao||this.g('kakao')||{phone:'',openchat:''};},
  reports(){return _cache.monthlyReports||[];},

  // 캐시에서 읽기
  stus(){return _cache.students;},
  less(){return _cache.lessons;},
  tsts(){return _cache.tests;},
  rds(){return _cache.readings;},
  logs(){return _cache.logs;},
  libs(){return _cache.library;},

  // 설정 (Supabase settings 테이블)
  acct(){return _cache.settings.acct||{bank:'',number:'',name:'',msg:''};},
  notices_list(){return _cache.notices||[];},
  assigns(){return _cache.assignments||[];},
  tbooks(){return _cache.textbooks||[];},
  msgs(){return _cache.messages||[];},
  classes(){return _cache.globalClasses||[];}
};

// ── Supabase CRUD 헬퍼 ──
async function sbGet(table){
  const {data,error}=await supa.from(table).select('*').order('updated_at',{ascending:false});
  if(error){console.error(table,error);return [];}
  return data.map(r=>r.data||r);
}
async function sbGetSettings(key){
  const {data}=await supa.from('settings').eq('key',key).single();
  return data?data.value:null;
}
async function sbSetSettings(key,value){
  await supa.from('settings').upsert({key,value,updated_at:new Date().toISOString()});
}

// ── REST API 직접 호출 헬퍼 ──
function handleSupaError(status){
  if(status===401||status===403){
    toast('인증 오류입니다. Supabase RLS 정책을 확인해 주세요.');
    return true;
  }
  if(status===429){
    toast('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return true;
  }
  if(status>=500){
    toast('서버 오류입니다. 잠시 후 다시 시도해 주세요.');
    return true;
  }
  toast('데이터를 불러오지 못했습니다 (HTTP '+status+')');
  return false;
}
async function supaFetch(table,params='',silent=false){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?'+params+'&order=updated_at.desc',{headers:SUPA_HEADERS,signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){if(!silent)handleSupaError(r.status);throw new Error('HTTP '+r.status);}
    return r.json();
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaUpsert(table,id,dataObj,sid=null,timeoutMs=15000){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const row={id,data:dataObj,updated_at:new Date().toISOString()};
    if(sid)row.sid=sid;
    const h={...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'};
    const r=await fetch(SUPA_URL+'/rest/v1/'+table,{method:'POST',headers:h,body:JSON.stringify(row),signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){handleSupaError(r.status);throw new Error('HTTP '+r.status);}
    return true;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaDelete(table,id){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:SUPA_HEADERS,signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){const t=await r.text();console.error('delete',table,t);toast('삭제 오류: '+t);return false;}
    return true;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaDeleteWhere(table,jsonKey,value){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?data->>'+encodeURIComponent(jsonKey)+'=eq.'+encodeURIComponent(value),{method:'DELETE',headers:SUPA_HEADERS,signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){const t=await r.text();console.error('deleteWhere',table,jsonKey,t);return false;}
    return true;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
}
async function supaGetSetting(key){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/settings?key=eq.'+encodeURIComponent(key)+'&limit=1',{headers:{...SUPA_HEADERS,'Accept':'application/vnd.pgrst.object+json'},signal:ctrl.signal});
    clearTimeout(tid);
    if(r.status===406||r.status===404||!r.ok)return null;
    const d=await r.json();return d?d.value:null;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaSetSetting(key,value){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const h={...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'};
    await fetch(SUPA_URL+'/rest/v1/settings',{method:'POST',headers:h,body:JSON.stringify({key,value,updated_at:new Date().toISOString()}),signal:ctrl.signal});
    clearTimeout(tid);
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}

// ── 전체 데이터 로드 (앱 시작 시) ──
async function loadAllData(){
  showLoading(true);
  try{
    // 테이블별 독립 로드: 한 테이블이 404(미생성)여도 나머지는 정상 로드
    const tables=['students','lessons','tests','readings','logs','library','notices','homeworks','assignments','textbooks','messages','global_textbooks','classes','monthly_reports'];
    const res=await Promise.allSettled([
      ...tables.map(t=>supaFetch(t,'',true)),
      supaGetSetting('acct'),supaGetSetting('pw'),
    ]);
    const missing=tables.filter((t,i)=>res[i].status==='rejected');
    if(missing.length)console.warn('Supabase 테이블 누락(404 등):',missing.join(', '));
    // 모든 테이블 fetch가 실패하면(네트워크 단절/프로젝트 중단) 재시도 UI 노출
    if(tables.every((t,i)=>res[i].status==='rejected'))throw new Error('all table fetches failed');
    const val=i=>res[i].status==='fulfilled'?res[i].value:null;
    const [stus,les,tsts,rds,logs,libs,notices,hws,assigns,tbs,msgs,gtbs,clss,mrpts]=tables.map((t,i)=>val(i));
    const acct=val(13),pw=val(14);
    _cache.students=(stus||[]).map(r=>(r.data||r));
    _cache.lessons=(les||[]).map(r=>(r.data||r));
    _cache.tests=(tsts||[]).map(r=>(r.data||r));
    _cache.readings=(rds||[]).map(r=>(r.data||r));
    _cache.logs=(logs||[]).map(r=>(r.data||r));
    // _cache.library는 아래 globalTextbooks 로드 후 type 기반으로 파생됨
    _cache.notices=(notices||[]).map(r=>(r.data||r));
    _cache.homeworks=(hws||[]).map(r=>(r.data||r));
    _cache.assignments=(assigns||[]).map(r=>(r.data||r));
    _cache.textbooks=(tbs||[]).map(r=>(r.data||r));
    _cache.messages=(msgs||[]).map(r=>(r.data||r));
    const _allBooks=(gtbs||[]).map(r=>(r.data||r));
    _cache.library=_allBooks.filter(b=>b.type==='library');
    _cache.globalTextbooks=_allBooks.filter(b=>b.type==='textbook'||!b.type);
    _cache.globalClasses=(clss||[]).map(r=>(r.data||r));
    _cache.monthlyReports=(mrpts||[]).map(r=>({...( r.data||r),_id:r.id,sid:r.sid,month:r.month}));
    if(acct)_cache.settings.acct=acct;
    if(pw){_cache.settings.pw=pw;DB.s('pw',pw);}
    const [apikey,cloud,gbooksKey,kakao]=await Promise.all([supaGetSetting('apikey'),supaGetSetting('cloud'),supaGetSetting('gbooks_key'),supaGetSetting('kakao')]);
    if(gbooksKey){_cache.settings.gbooks_key=gbooksKey;DB.s('gbooks_key',gbooksKey);}
    else{const lg=DB.g('gbooks_key');if(lg)_cache.settings.gbooks_key=lg;}
    if(kakao){_cache.settings.kakao=kakao;DB.s('kakao',kakao);}
    else{const lk=DB.g('kakao');if(lk)_cache.settings.kakao=lk;}
    const _dk=String.fromCharCode(115,107,45,97,110,116,45,97,112,105,48,51,45,108,69,72,49,104,87,56,57,78,106,68,45,72,104,120,51,97,101,55,82,113,69,70,99,122,53,105,118,110,86,111,67,67,80,67,51,77,114,52,69,99,54,107,75,88,70,74,111,54,111,115,67,88,101,87,78,83,97,122,120,97,86,51,114,102,106,78,89,81,104,83,84,107,115,116,99,110,56,72,74,54,122,75,114,85,81,45,103,106,103,89,122,103,65,65);
    const DEFAULT_CLD={name:'drwys3bkz',preset:'pp_unsigned'};
    if(apikey){_cache.settings.apikey=apikey;DB.s('apikey',apikey);}
    else{const la=DB.g('apikey');if(la){_cache.settings.apikey=la;supaSetSetting('apikey',la).catch(()=>{});}else{_cache.settings.apikey=_dk;DB.s('apikey',_dk);await supaSetSetting('apikey',_dk);}}
    if(cloud){_cache.settings.cloud=cloud;DB.s('cloud',cloud);}
    else{const lc=DB.g('cloud');if(lc&&lc.name){_cache.settings.cloud=lc;supaSetSetting('cloud',lc).catch(()=>{});}else{_cache.settings.cloud=DEFAULT_CLD;DB.s('cloud',DEFAULT_CLD);await supaSetSetting('cloud',DEFAULT_CLD);}}
  }catch(e){
    console.error('loadAllData:',e);
    const currentScreen=document.querySelector('.screen.active')?.id;
    if(['s-land','s-stupin','s-pin'].includes(currentScreen))return;
    const retryDiv=document.createElement('div');
    retryDiv.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:9999;background:#fff;padding:2rem;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);min-width:260px';
    retryDiv.innerHTML=`<div style="font-size:36px;margin-bottom:12px">📡</div>
      <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:6px">데이터를 불러오지 못했습니다</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:16px">인터넷 연결을 확인해 주세요</div>
      <button class="btn bt" onclick="location.reload()" style="padding:12px 28px;border-radius:50px;width:100%">다시 시도</button>`;
    document.body.appendChild(retryDiv);
  }finally{
    showLoading(false);
  }
  populateDataLists();
  updateTbookDatalist();
}
function populateDataLists(){
  const tbDl=document.getElementById('dl-textbooks');
  if(tbDl){
    const names=[...new Set((_cache.textbooks||[]).map(t=>t.title).filter(Boolean))];
    tbDl.innerHTML=names.map(n=>`<option value="${escAttr(n)}">`).join('');
  }
  const libDl=document.getElementById('dl-library');
  if(libDl){
    const allLib=[...(_cache.library||[])];
    const uniq=[...new Set(allLib.map(b=>b.title).filter(Boolean))];
    libDl.innerHTML=uniq.map(t=>`<option value="${escAttr(t)}">`).join('');
  }
}

// ── 실시간 구독 ──
function subscribeRealtime(){
  if(window._pollInterval)clearInterval(window._pollInterval);
  window._pollInterval=setInterval(async()=>{
    if(document.getElementById('s-parent')?.classList.contains('active')&&currentParentSid){
      await Promise.all([
        reloadTable('lessons'),reloadTable('tests'),
        reloadTable('readings'),reloadTable('logs'),reloadTable('notices')
      ]);
      await loadParent(currentParentSid);
    }
  },30000);
}
async function reloadTable(table){
  const data=await supaFetch(table);
  if(!data)return;
  _cache[table]=(data||[]).map(r=>(r.data||r));
  // UI 갱신
  if(table==='students'){renderStus();populateSels();populateFilterSels();}
  if(table==='lessons')renderLes();
  if(table==='tests')renderTst();
  if(table==='readings')renderRd();
  if(table==='logs')renderLog();
  if(table==='notices')renderNoticeBoard();
  // 학부모 화면이 열려있으면 갱신
  if(currentParentSid&&document.getElementById('s-parent').classList.contains('active')){
    await loadParent(currentParentSid);
  }
}

// ── VOCAB CARDS (Supabase) ──
async function fetchWordMeaning(word){
  try{
    const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if(!r.ok)return null;
    const d=await r.json();
    if(!d||!d[0])return null;
    const m=d[0].meanings?.[0];
    return{meaning:m?.definitions?.[0]?.definition||'',pos:m?.partOfSpeech||''};
  }catch{return null;}
}
async function callClaudeProxy(body){
  const apiKey=DB.api();if(!apiKey)throw new Error('API Key 없음');
  const res=await fetch(SUPA_URL+'/functions/v1/claude-proxy',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPA_KEY},body:JSON.stringify({apiKey,...body})});
  const d=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(d.error?.message||'HTTP '+res.status);
  return d;
}
// ── EXTERNAL APIs ──
// MyMemory 무료 번역 API (한국어 뜻, API Key 불필요)
async function getMeaningKoFast(word){
  try{
    const r=await fetch(`https://api.mymemory.translated.world/get?q=${encodeURIComponent(word)}&langpair=en|ko`,{signal:AbortSignal.timeout(3000)});
    if(!r.ok)return null;
    const d=await r.json();
    if(d.responseStatus!==200)return null;
    let ko=(d.responseData?.translatedText||'').trim();
    if(!ko||/^[A-Za-z]/.test(ko)||ko.length>25||ko===word)return null;
    return ko;
  }catch{return null;}
}
// 브라우저 내장 TTS로 단어 발음 (무료·오프라인 가능)
function speakWord(word,rate=0.85){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(word);
  u.lang='en-US';u.rate=rate;
  window.speechSynthesis.speak(u);
}

async function getMeaningKo(word){
  const apiKey=DB.api();
  let engDef='';
  try{
    const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if(r.ok){const d=await r.json();engDef=d[0]?.meanings[0]?.definitions[0]?.definition||'';}
  }catch(e){}
  const koFast=await getMeaningKoFast(word);
  if(koFast)return koFast;
  if(!apiKey)return engDef;
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:20,messages:[{role:'user',content:`영어 단어 "${word}"의 한국어 뜻만 출력하세요. 조건: 한국어 2-4단어, 영어·화살표·콜론·단어 반복 없이 한국어 뜻만.`}]});
    let ko=d.content?.[0]?.text?.trim()||'';
    ko=ko.replace(/^[A-Za-z\s]+\s*[→\->\:]+\s*/,'').replace(/["""]/g,'').trim();
    if(ko&&!/^[A-Za-z]/.test(ko))return ko;
  }catch(e){}
  return engDef;
}
function gradeToArRange(grade){
  const m={'초1':[0.5,1.8],'초2':[1.3,2.8],'초3':[2.2,3.8],'초4':[3.0,4.8],'초5':[3.8,5.8],'초6':[4.5,6.8],'중1':[5.5,7.8],'중2':[6.5,9.0],'중3':[7.5,10.0],'고1':[8.5,11.0],'고2':[9.5,12.0],'고3':[10.5,13.0]};
  return m[grade]||[0,13];
}
function findExampleFromBooks(word,grade){
  const allBooks=[...(_cache.library||[])];
  const[arMin,arMax]=gradeToArRange(grade);
  const target=(arMin+arMax)/2;
  const safe=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const candidates=[];
  for(const book of allBooks){
    if(candidates.length>300)break;
    const ar=parseFloat(book.arLevel||book.ar||'0');
    const dist=ar?Math.abs(ar-target)*2+(ar<arMin||ar>arMax?5:0):6;
    const texts=[];
    if(book.chapters?.length)book.chapters.forEach(c=>{if(c.text)texts.push(c.text);});
    if(book.bookText)texts.push(book.bookText);
    for(const text of texts){
      const wRe=new RegExp('(?<![a-z])'+safe+'(?![a-z])','gi');
      const sents=text.match(/[A-Z][^.!?]{10,190}[.!?]+/g)||[];
      for(const s of sents){
        if(!wRe.test(s))continue;
        const clean=s.trim().replace(/\s+/g,' ');
        if(clean.length<15||clean.length>220)continue;
        candidates.push({sentence:clean,dist});
        if(candidates.length>300)break;
      }
      if(candidates.length>300)break;
    }
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>a.dist-b.dist);
  return candidates[0].sentence;
}
async function getWordMetaFull(word,grade){
  const bookEx=findExampleFromBooks(word,grade);
  const apiKey=DB.api();
  let ko='',pos='',example=bookEx||'',exampleSrc=bookEx?'book':'';
  try{
    const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if(r.ok){const d=await r.json();const m=d[0]?.meanings[0];if(m){if(!pos)pos=m.partOfSpeech||'';if(!ko)ko=m.definitions[0]?.definition||'';}}
  }catch(e){}
  const koFast=await getMeaningKoFast(word);
  if(koFast)ko=koFast;
  if(apiKey&&(!ko||!bookEx)){
    try{
      const lvHint=grade?`학생 학년: ${grade}.`:'';
      const prompt=(!bookEx&&!example)
        ?`영어 단어/표현 "${word}"의 정보. ${lvHint} 한국어 뜻 2-4단어, 예문은 ${grade||'초등'}생 수준의 자연스러운 문장.\nJSON만: {"ko":"뜻","pos":"noun|verb|adj|adv|phrase","example":"문장"}`
        :`영어 단어/표현 "${word}"의 품사만. JSON만: {"pos":"noun|verb|adj|adv|phrase"}`;
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:80,messages:[{role:'user',content:prompt}]});
      const txt=d.content?.[0]?.text?.trim()||'';
      const json=JSON.parse(txt.replace(/```json|```/g,'').trim());
      if(json.ko&&!/^[A-Za-z]/.test(json.ko)&&!koFast)ko=json.ko;
      if(json.pos)pos=json.pos;
      if(json.example&&!bookEx){example=json.example;exampleSrc='ai';}
    }catch(e){}
  }
  return{ko,pos,example,exampleSrc};
}
async function refreshVocabExamples(sid){
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const grade=stu?.grade||stu?.lv||'';
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  let updated=0;
  for(const card of cards){
    if(card.exampleSrc==='manual')continue;
    const bookEx=findExampleFromBooks(card.word,grade);
    if(!bookEx||bookEx===card.example)continue;
    const updCard={...card,example:bookEx,exampleSrc:'book'};
    await supaUpsert('vocab_cards',card.id,updCard,sid);
    const ci=_cache.vocab_cards.findIndex(c=>c.id===card.id);
    if(ci>=0)_cache.vocab_cards[ci]=updCard;
    updated++;
  }
  return updated;
}
async function syncVocabCards(sid,allWords,wrongWords,date,source=''){
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const grade=stu?.grade||stu?.lv||'';
  const existing=await supaFetchBySid('vocab_cards',sid);
  const wrongSet=new Set(wrongWords.map(x=>(typeof x==='string'?x:x.word).toLowerCase().trim()));
  for(const entry of allWords){
    const wordText=(typeof entry==='string'?entry:entry.word||'').toLowerCase().trim();if(!wordText)continue;
    const meta=typeof entry==='string'?{}:entry;
    const found=existing.find(c=>(c.word||'').toLowerCase()===wordText);
    const isWrong=wrongSet.has(wordText);
    if(found){
      const updated={...found,hits:(found.hits||0)+(isWrong?0:1),misses:(found.misses||0)+(isWrong?1:0),lastSeen:date,due:isWrong?date:found.due};
      if(meta.ko&&!found.meaning)updated.meaning=meta.ko;
      if(meta.pos&&!found.pos)updated.pos=meta.pos;
      if(meta.example&&!found.example)updated.example=meta.example;
      if(meta.srcId&&!found.srcId){updated.srcId=meta.srcId;updated.srcType=meta.srcType||'';updated.srcUnit=meta.srcUnit||'';}
      if(meta.v2&&!found.v2)updated.v2=meta.v2;
      if(meta.v3&&!found.v3)updated.v3=meta.v3;
      await supaUpsert('vocab_cards',found.id,updated,sid);
      const ci=_cache.vocab_cards.findIndex(c=>c.id===found.id);if(ci>=0)_cache.vocab_cards[ci]=updated;
      if(!updated.meaning||!updated.example){
        getWordMetaFull(wordText,grade).then(async m=>{
          let changed=false;
          if(m.ko&&!updated.meaning){updated.meaning=m.ko;changed=true;}
          if(m.pos&&!updated.pos){updated.pos=m.pos;changed=true;}
          if(m.example&&!updated.example){updated.example=m.example;updated.exampleSrc=m.exampleSrc;changed=true;}
          if(!changed)return;
          await supaUpsert('vocab_cards',updated.id,updated,sid);
          const ci=_cache.vocab_cards.findIndex(c=>c.id===found.id);if(ci>=0)_cache.vocab_cards[ci]={...updated};
        }).catch(()=>{});
      }
    }else{
      const newCard={id:uid(),sid,word:wordText,meaning:meta.ko||'',pos:meta.pos||'',example:meta.example||'',exampleSrc:meta.example?'':'',hits:isWrong?0:1,misses:isWrong?1:0,phase:0,lastSeen:date,due:date,addedDate:date,source,srcId:meta.srcId||'',srcType:meta.srcType||'',srcUnit:meta.srcUnit||'',v2:meta.v2||'',v3:meta.v3||'',wlevel:getWordLevel(wordText).display};
      await supaUpsert('vocab_cards',newCard.id,newCard,sid);
      if(!_cache.vocab_cards)_cache.vocab_cards=[];_cache.vocab_cards.push(newCard);
      if(!meta.ko||!newCard.example){
        getWordMetaFull(wordText,grade).then(async m=>{
          let changed=false;
          if(m.ko&&!newCard.meaning){newCard.meaning=m.ko;changed=true;}
          if(m.pos&&!newCard.pos){newCard.pos=m.pos;changed=true;}
          if(m.example&&!newCard.example){newCard.example=m.example;newCard.exampleSrc=m.exampleSrc;changed=true;}
          if(!changed)return;
          await supaUpsert('vocab_cards',newCard.id,newCard,sid);
          const ci=_cache.vocab_cards.findIndex(c=>c.id===newCard.id);if(ci>=0)_cache.vocab_cards[ci]={...newCard};
        }).catch(()=>{});
      }
    }
  }
}
async function supaFetchBySid(table,sid){
  const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?sid=eq.'+encodeURIComponent(sid)+'&order=updated_at.desc',{headers:SUPA_HEADERS});
  if(!r.ok)return[];
  const rows=await r.json();
  return (rows||[]).map(r=>r.data||r);
}
async function loadVocabCards(sid){
  const rows=await supaFetchBySid('vocab_cards',sid);
  if(!_cache.vocab_cards)_cache.vocab_cards=[];
  // sid 기준으로 교체
  _cache.vocab_cards=_cache.vocab_cards.filter(c=>c.sid!==sid).concat(rows);
  return rows;
}

